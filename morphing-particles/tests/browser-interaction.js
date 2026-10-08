const trigger = document.querySelector('[data-hover-trigger]');
const canvas = document.querySelector('[data-container] canvas');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const colorCounts = () => {
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let red = 0, blue = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 10) {
    if (pixels[i] > 150 && pixels[i + 1] < 130 && pixels[i + 2] < 130) red++;
    if (pixels[i] < 150 && pixels[i + 2] > 150) blue++;
  }
  return { red, blue };
};
trigger.dispatchEvent(new MouseEvent('mouseleave'));
await wait(900);
const rest = colorCounts();
trigger.dispatchEvent(new MouseEvent('mouseenter'));
await wait(900);
const hover = colorCounts();
if (!(hover.red > rest.red && hover.blue < rest.blue)) throw new Error('Hover did not change particle colors');
trigger.dispatchEvent(new MouseEvent('mouseleave'));
await wait(900);
const leave = colorCounts();
if (!(leave.blue > hover.blue)) throw new Error('Leave did not restore particle colors');
trigger.querySelector('a').focus();
await wait(900);
const focus = colorCounts();
if (!(focus.red > leave.red)) throw new Error('Focus did not change particle colors');
trigger.querySelector('a').blur();
await wait(900);
const blur = colorCounts();
if (!(blur.blue > focus.blue)) throw new Error('Blur did not restore particle colors');
return { status: 'PASS', rest, hover, leave, focus, blur };
