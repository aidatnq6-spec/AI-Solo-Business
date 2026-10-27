import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderPoster, validateLogo } from "@/lib/media/poster";
describe('PNG assets',()=>{
 it('renders a real 1080px PNG containing Vietnamese layout',async()=>{const bytes=await renderPoster({title:'Kế toán cần chuẩn bị gì trước khi gia hạn chữ ký số?',brand:'Sổ Nội Dung',contact:'Liên hệ tư vấn',product:'Chữ ký số'});expect((await sharp(bytes).metadata()).width).toBe(1080);expect((await sharp(bytes).metadata()).format).toBe('png');expect(bytes.length).toBeGreaterThan(10000);});
 it('rejects uploaded SVG, fake images and oversized logos',async()=>{await expect(validateLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'))).rejects.toThrow();await expect(validateLogo(Buffer.from('not an image'))).rejects.toThrow();await expect(validateLogo(Buffer.alloc(5*1024*1024+1))).rejects.toThrow();});
});
