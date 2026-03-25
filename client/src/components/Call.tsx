import React, { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer/simplepeer.min.js';
import socket from '../socket';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Monitor } from 'lucide-react';

interface CallProps {
  userId: number;
  callData: any;
  onClose: () => void;
}

const Call: React.FC<CallProps> = ({ userId, callData, onClose }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected'>('ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const connectionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Ringtone setup
    const ringtone = new Audio(callData.incoming 
      ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
      : 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'
    );
    ringtone.loop = true;
    ringtoneRef.current = ringtone;
    if (callStatus === 'ringing') {
      ringtone.play().catch(e => console.log('Autoplay blocked ringing', e));
    }

    const startMedia = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some(d => d.kind === 'videoinput');
        const constraints = { 
          video: hasVideo && callData.video === true ? { width: 1280, height: 720 } : false, 
          audio: true 
        };

        const currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(currentStream);
        streamRef.current = currentStream;

        if (!callData.incoming) {
          if (callData.video) await new Promise(r => setTimeout(r, 500));
          
          const peer = new Peer({ 
            initiator: true, 
            trickle: true, 
            stream: currentStream,
            config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] }
          });

          peer.on('signal', (data: any) => {
            console.log('SIGNAL (Initiator):', data.type || 'candidate');
            if (connectionRef.current && connectionRef.current.connected) {
              socket.emit('call-signal', { to: callData.to, signal: data });
            } else if (data.type === 'offer') {
                socket.emit('call-user', { 
                  userToCall: callData.to, 
                  signalData: data, 
                  from: userId,
                  video: !!constraints.video
                });
            } else if (data.candidate) {
                // For trickle candidates before connection
                socket.emit('call-signal', { to: callData.to, signal: data });
            }
          });

          peer.on('stream', (rStream: MediaStream) => {
            console.log('Remote stream received:', rStream.id);
            if (!remoteStreamRef.current || rStream.id === remoteStreamRef.current.id) {
              setRemoteStream(rStream);
              remoteStreamRef.current = rStream;
            } else {
              console.log('Detected secondary screen stream');
              setRemoteScreenStream(rStream);
            }
          });

          socket.on('call-accepted', (signal) => {
            console.log('Call accepted');
            setCallStatus('connected');
            if (peer) peer.signal(signal);
          });

          connectionRef.current = peer;
        }
      } catch (err: any) {
        console.error('Failed to get media:', err);
        onClose();
      }
    };

    startMedia();

    socket.on('call-ended', () => onClose());
    socket.on('call-rejected', () => {
        alert('Call rejected');
        onClose();
    });

    socket.on('call-signal', (data) => {
      if (connectionRef.current) {
        console.log('Received remote signal');
        connectionRef.current.signal(data.signal);
      }
    });

    return () => {
      ringtoneRef.current?.pause();
      socket.off('call-accepted');
      socket.off('call-rejected');
      socket.off('call-ended');
      socket.off('call-signal');
      
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      connectionRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (callStatus === 'connected') {
      ringtoneRef.current?.pause();
    }
  }, [callStatus]);

  const answerCall = () => {
    if (!stream) return;
    setCallStatus('connected');
    const peer = new Peer({ 
      initiator: false, 
      trickle: true, 
      stream: stream,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] }
    });

    peer.on('signal', (data: any) => {
      console.log('SIGNAL (Receiver):', data.type || 'candidate');
      if (connectionRef.current && connectionRef.current.connected) {
        socket.emit('call-signal', { to: callData.from, signal: data });
      } else if (data.type === 'answer') {
        socket.emit('answer-call', { signal: data, to: callData.from });
      } else if (data.candidate) {
        socket.emit('call-signal', { to: callData.from, signal: data });
      }
    });

    peer.on('stream', (rStream: MediaStream) => {
      console.log('Receiver Stream received:', rStream.id);
      if (!remoteStreamRef.current || rStream.id === remoteStreamRef.current.id) {
        setRemoteStream(rStream);
        remoteStreamRef.current = rStream;
      } else {
        setRemoteScreenStream(rStream);
      }
    });

    peer.signal(callData.signal);
    connectionRef.current = peer;
  };

  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const endCall = () => {
    const to = callData.incoming ? callData.from : callData.to;
    socket.emit('end-call', { to });
    onClose();
  };

  const toggleScreenShare = async () => {
    if (!connectionRef.current) return;

    if (!isSharingScreen) {
      try {
        let scrStream: MediaStream;
        try {
          scrStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } catch (e) {
          scrStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }
        
        screenStreamRef.current = scrStream;
        connectionRef.current.addStream(scrStream);
        
        scrStream.getVideoTracks()[0].onended = () => stopScreenShare();
        setIsSharingScreen(true);
      } catch (err) {
        console.error('Failed to share screen:', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current && connectionRef.current) {
        try {
            connectionRef.current.removeStream(screenStreamRef.current);
        } catch(e) {}
        screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
    setIsSharingScreen(false);
    screenStreamRef.current = null;
  };

  return (
    <div className="call-overlay glass-panel">
      {remoteScreenStream && (
        <div className="remote-screen-container animate-fade-in" style={{ width: '80%', maxWidth: '1000px', marginBottom: '20px' }}>
          <video 
            playsInline autoPlay 
            ref={(el) => {
              if (el && el.srcObject !== remoteScreenStream) {
                el.srcObject = remoteScreenStream;
                el.play().catch(() => {});
              }
            }} 
            style={{ width: '100%', borderRadius: '12px', border: '2px solid var(--primary)', boxShadow: '0 0 20px var(--primary-glow)' }} 
          />
          <p style={{ textAlign: 'center', marginTop: '10px', color: 'var(--primary)' }}>Демонстрация экрана</p>
        </div>
      )}

      <div className="video-container" style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
        <div style={{ position: 'relative', width: '200px', height: '200px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary)', background: '#17212b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {stream && !isVideoOff ? (
            <video 
              playsInline muted autoPlay 
              ref={(el) => {
                if (el && el.srcObject !== stream) {
                  el.srcObject = stream;
                  el.play().catch(() => {});
                }
              }} 
              style={{ transform: 'scaleX(-1)', width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <span style={{ fontSize: '48px' }}>Вы</span>
          )}
        </div>
        
        <div style={{ position: 'relative', width: '200px', height: '200px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary)', background: '#17212b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video 
            playsInline autoPlay 
            ref={(el) => {
              if (el && el.srcObject !== remoteStream) {
                el.srcObject = remoteStream;
                el.play().catch(() => {});
              }
            }} 
            style={{ 
              width: '100%', height: '100%', objectFit: 'cover',
              display: (remoteStream && callData.video) ? 'block' : 'none' 
            }} 
          />
          {(!remoteStream || !callData.video) && <span style={{ fontSize: '48px' }}>❄️</span>}
        </div>
      </div>

      <div style={{ marginTop: '40px', display: 'flex', gap: '20px' }}>
        <button className="btn-primary" onClick={toggleMute} style={{ background: isMuted ? '#ff4d4d' : 'var(--glass-bg)' }}>
          {isMuted ? <MicOff /> : <Mic />}
        </button>
        <button className="btn-primary" onClick={toggleVideo} style={{ background: isVideoOff ? '#ff4d4d' : 'var(--glass-bg)' }}>
          {isVideoOff ? <VideoOff /> : <Video />}
        </button>
        <button className="btn-primary" onClick={toggleScreenShare} style={{ background: isSharingScreen ? 'var(--primary)' : 'var(--glass-bg)' }}>
          <Monitor />
        </button>
        {callData.incoming && callStatus === 'ringing' ? (
          <>
            <button className="btn-primary" onClick={answerCall} style={{ background: '#4ade80' }}>Ответить</button>
            <button className="btn-primary" onClick={() => socket.emit('reject-call', { to: callData.from })} style={{ background: '#ff4d4d' }}>Отклонить</button>
          </>
        ) : (
          <button className="btn-primary" onClick={endCall} style={{ background: '#ff4d4d' }}><PhoneOff /></button>
        )}
      </div>
    </div>
  );
};

export default Call;
