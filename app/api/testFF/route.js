import path from 'path'
import { promisify } from 'util';
import { exec } from 'child_process';
import { NextResponse } from 'next/server';


export async function GET() {
    const execPromisify = promisify(exec);

    const inputPath = path.join(process.cwd(), 'temp', 'input_video.mp4');
    const outputPath = path.join(process.cwd(), 'public', 'transparent.webm');

    console.log('removing green screen')
    const command = `ffmpeg -y -i "https://d2ym0mcwdtattp.cloudfront.net/1/hjuilq/5c2fa18f-9f6e-464f-9b6f-274e78888f8d" -vf "colorkey=0x6ceb97:0.2:0.15,despill=green:mix=0.5" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 2M -auto-alt-ref 0 "${outputPath}"`;

    await execPromisify(command);

    console.log('video generated');

    return NextResponse.json(command)
}