import { spawn } from 'child_process';
import fs from 'fs';

const ssh = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  'root@85.198.97.189',
  'cat > /root/morozka.tar'
], {
  stdio: ['pipe', 'inherit', 'inherit']
});

const fileStream = fs.createReadStream('morozka.tar');
fileStream.pipe(ssh.stdin);

ssh.stdin.on('error', (err) => console.error('Stdin error:', err));
ssh.on('close', (code) => console.log('SSH closed with code:', code));
