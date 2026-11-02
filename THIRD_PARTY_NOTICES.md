# Third-party notices

## Whale girl — dsh-pet

Animation source and original project: https://github.com/PC2005-cloud/dsh-pet

Pinned source revision: `38ae8465cd69ba15e8c8a29e7208997a0baa3451`, directory `dsh-pet/assets/webm/`.

Character prototype 「溟月」: 上善无形 (https://space.bilibili.com/4456176).
DeepSeek maid whale-girl design: ZipZipPipe (https://space.bilibili.com/4168597).
This is a community derivative character, not an official DeepSeek character.

The upstream README licenses character artwork under **CC BY-NC-SA 4.0** (Attribution–NonCommercial–ShareAlike) and permits open-source use of its animation assets while prohibiting commercial use. The adapted animation strips embedded in `WHALE_GIRL_ART` retain these terms; the package's MIT code license does not relicense this artwork.

License: https://creativecommons.org/licenses/by-nc-sa/4.0/
Legal text: https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
Upstream attribution and license statement: https://github.com/PC2005-cloud/dsh-pet/blob/38ae8465cd69ba15e8c8a29e7208997a0baa3451/README.md#许可
Character creator's statement: https://www.bilibili.com/opus/1247156596114456581

Modifications: extracted transparent VP9-alpha video frames, cropped the central 340×360 region (x=150, y=0), resized to 170×180, sampled at 12 fps, and encoded as WebP strips embedded in `client.js`. The running sprite is mirrored during rightward travel. No upstream runtime code is included.

| Embedded strip | Original animation | Start time | Frames |
| --- | --- | --- | --- |
| run | 原地左转奔跑.webm | 1.8 s | 24 |
| wave | 点击回应-元气挥手.webm | 2.8 s | 24 |
| shy | 点击回应-害羞惊讶.webm | 4.0 s | 24 |
| happy | 点击回应-开心跃动.webm | 3.4 s | 24 |
| celebrate | 工作状态-雀跃庆祝.webm | 2.6 s | 24 |
| idle | 待机呼吸休闲.webm | 0 s | 1 |

When redistributing the character or adapted strips, retain the author credits, original project link, license link and modification notice above. Adapted artwork remains available under CC BY-NC-SA 4.0.

## Mechvibes — Cherry MX Blue ABS

Eight short keyboard strokes (A/S/D/F/J/K/Space/Backspace), extracted from the official sound pack. Embedded as mono 24 kHz PCM in `client.js`; trimmed, level-matched and lightly faded at the cut edges.

Source: https://github.com/hainguyents13/mechvibes/tree/e94ad2fd9a31e77c8a3c9dc5617d6ac91eb581df/soundpacks/keyboard/cherrymx-blue-abs

MIT License

Copyright (c) 2026 Hải Nguyễn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Upstream typing-effect sprites

Original particle and magic sprites are adapted from vscode-power-mode, Copyright (c) 2017 Cody Hoover. The original MIT notice is retained in `LICENSE-upstream-effects.txt`.

## Fonts

Barlow Condensed and the Noto Sans SC font subset are embedded in `client.js`. Their original copyright and SIL Open Font License notices are retained in `LICENSE-Barlow-Condensed.txt` and `LICENSE-Noto-Sans-SC.txt`.

## Locally generated companion artwork

The cat and dog sprite atlases were generated for the user's earlier local prototype and adapted for this plugin.
