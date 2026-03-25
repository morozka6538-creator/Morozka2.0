import fs from 'fs';

async function upload() {
  const fileData = fs.readFileSync('id_morozka.pub');
  const blob = new Blob([fileData], { type: 'text/plain' });
  const formData = new FormData();
  formData.append('file', blob, 'morozka_key.pub');

  const response = await fetch('https://file.io', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  console.log(result.link);
}

upload().catch(console.error);
