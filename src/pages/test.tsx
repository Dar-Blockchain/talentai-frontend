// pages/test.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  useTheme,
  Container,
  LinearProgress,
  Paper,
  styled,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CallEndIcon from '@mui/icons-material/CallEnd';

// --- Inline Next.js Questions JSON ---
const NEXTJS_QUESTIONS = [
  "Explain the difference between getStaticProps and getServerSideProps. When would you choose one over the other?",
  "How does Incremental Static Regeneration (ISR) work in Next.js, and what are its benefits?",
  "Describe how dynamic routes work in Next.js. How would you implement a blog post page that uses dynamic slugs?",
  "What is the purpose of the Next.js Image component, and how does it improve performance?",
  "How do API routes in Next.js differ from a traditional Express.js API? Give an example of defining an API route.",
  "What are middleware in Next.js 12+? Provide a use case where you might use middleware.",
  "Explain the new App Router introduced in Next.js 13. How does it differ from the Pages Router?",
  "How would you handle authentication and authorization in a Next.js application?",
  "What strategies can you use in Next.js to optimize bundle size and improve performance?",
  "Describe how environment variables are managed in Next.js. How would you securely store and access a third‑party API key?"
];

// --- Styled Components ---
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: 'rgba(0, 7, 45, 0.8)',
  backdropFilter: 'blur(10px)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
}));

const RecordingControls = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  zIndex: 2,
  background: 'rgba(0, 0, 0, 0.5)',
  padding: theme.spacing(2),
  borderRadius: '16px',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  minWidth: '300px',
}));

const RecordingButton = styled(Button)(({ theme }) => ({
  width: '100%',
  padding: theme.spacing(1.5),
  fontSize: '1.1rem',
  fontWeight: 600,
  borderRadius: '12px',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'scale(1.02)',
  },
}));

const TranscriptDisplay = styled(Typography)(({ theme }) => ({
  color: '#fff',
  textAlign: 'center',
  maxWidth: '90%',
  background: 'rgba(0, 0, 0, 0.6)',
  padding: theme.spacing(2),
  borderRadius: '12px',
  backdropFilter: 'blur(5px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  marginTop: theme.spacing(1),
  maxHeight: '150px',
  overflowY: 'auto',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '3px',
  },
}));

const QuestionOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 0,
  width: '100%',
  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
  color: '#fff',
  padding: theme.spacing(3),
  backdropFilter: 'blur(5px)',
}));

const NavigationBar = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  background: 'rgba(0, 7, 45, 0.8)',
  backdropFilter: 'blur(10px)',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}));

// --- SpeechRecognition Types ---
declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionError) => any) | null;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionError extends Event {
  error: string;
  message: string;
}

export default function Test() {
  const theme = useTheme();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [current, setCurrent] = useState(0);
  const [transcripts, setTranscripts] = useState<string[]>(
    Array(NEXTJS_QUESTIONS.length).fill('')
  );
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [timeLeft, setTimeLeft] = useState(5);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const currentIndexRef = useRef(0);

  // Sync ref & reset interim + timer on question change
  useEffect(() => {
    currentIndexRef.current = current;
    setCurrentTranscript('');
    setTimeLeft(5);
  }, [current]);

  // Initialize camera
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        }
      } catch (e) {
        console.error('Camera error', e);
      }
    })();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // Initialize speech recognition once
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window)) return;
    const recog = new window.webkitSpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';

    recog.onresult = (ev: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) {
          const text = res[0].transcript.trim() + ' ';
          setTranscripts(prev => {
            const copy = [...prev];
            copy[currentIndexRef.current] = (copy[currentIndexRef.current] + text).trim();
            localStorage.setItem('test_transcripts', JSON.stringify(copy));
            return copy;
          });
        } else {
          interim += res[0].transcript;
        }
      }
      setCurrentTranscript(interim);
    };

    recog.onerror = e => console.error('Speech error', e);
    recognitionRef.current = recog;
    return () => recog.stop();
  }, []);

  // Countdown timer while recording
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      setTimeLeft(t => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording, current]);

  // Auto‑advance when timer hits zero
  useEffect(() => {
    if (timeLeft === 0) {
      setCurrent(c => Math.min(c + 1, NEXTJS_QUESTIONS.length - 1));
    }
  }, [timeLeft]);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setTimeLeft(5);
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handlePrev = () => setCurrent(c => Math.max(0, c - 1));
  const handleNext = () => {
    if (current < NEXTJS_QUESTIONS.length - 1) setCurrent(c => c + 1);
    else router.push('/report');
  };

  const goHome = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    router.push('/');
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: '#00072D',
      backgroundImage: `
        radial-gradient(circle at 20% 30%, rgba(2,226,255,0.4), transparent 40%),
        radial-gradient(circle at 80% 70%, rgba(0,255,195,0.3), transparent 50%)
      `,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <StyledAppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{
            flexGrow: 1,
            background: 'linear-gradient(135deg, #02E2FF 0%, #00FFC3 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 700,
          }}>
            Skill Test ({current + 1}/{NEXTJS_QUESTIONS.length})
          </Typography>
          <Typography variant="subtitle1" sx={{ color: '#fff', mr: 2 }}>
            0:{timeLeft.toString().padStart(2, '0')}
          </Typography>
          <Button
            startIcon={<CallEndIcon />}
            onClick={goHome}
            variant="outlined"
            sx={{
              color: theme.palette.error.main,
              borderColor: theme.palette.error.main,
              textTransform: 'none',
              borderRadius: 2,
              px: 3,
              '&:hover': { backgroundColor: 'rgba(244,67,54,0.1)' },
            }}
          >
            End Test
          </Button>
        </Toolbar>
        <LinearProgress
          variant="determinate"
          value={((current + 1) / NEXTJS_QUESTIONS.length) * 100}
          sx={{
            height: 4,
            backgroundColor: 'rgba(255,255,255,0.1)',
            '& .MuiLinearProgress-bar': {
              backgroundImage: 'linear-gradient(135deg, #02E2FF 0%, #00FFC3 100%)',
            },
          }}
        />
      </StyledAppBar>

      <Container maxWidth="md" sx={{
        flexGrow: 1,
        py: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Paper elevation={12} sx={{
          position: 'relative',
          width: '100%',
          pt: '56.25%', // 16:9
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
              borderRadius: '24px',
            }}
          />

          <RecordingControls>
            <RecordingButton
              variant="contained"
              onClick={toggleRecording}
              sx={{
                backgroundColor: isRecording ? '#ff4444' : '#02E2FF',
                '&:hover': {
                  backgroundColor: isRecording ? '#cc0000' : '#00C3FF',
                },
              }}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </RecordingButton>
            {currentTranscript && (
              <TranscriptDisplay variant="body2">
                {currentTranscript}
              </TranscriptDisplay>
            )}
          </RecordingControls>

          <QuestionOverlay>
            <Typography variant="h6" sx={{ color: '#fff' }}>
              {NEXTJS_QUESTIONS[current]}
            </Typography>
          </QuestionOverlay>
        </Paper>
      </Container>

      <NavigationBar>
        <IconButton onClick={handlePrev} disabled={current === 0} sx={{ color: '#fff' }}>
          <ArrowBackIcon />
        </IconButton>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={handleNext}
          sx={{
            textTransform: 'none',
            background: 'linear-gradient(135deg, #02E2FF 0%, #00FFC3 100%)',
            borderRadius: 2,
            px: 4,
            py: 1.5,
            '&:hover': {
              background: 'linear-gradient(135deg, #00C3FF 0%, #00E2B8 100%)',
            },
          }}
        >
          {current < NEXTJS_QUESTIONS.length - 1 ? 'Next Question' : 'Finish Test'}
        </Button>
      </NavigationBar>
    </Box>
  );
}
