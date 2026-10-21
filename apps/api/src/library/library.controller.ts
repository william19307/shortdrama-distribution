import { BadRequestException, Body, Controller, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { selectionExecuteSchema, selectionExportSchema, selectionPreviewSchema } from '@shortform/shared';
import { Response } from 'express';
import { z } from 'zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { ZodPipe } from '../core/zod.pipe';
import { LibraryService } from './library.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Post('library/metadata-import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  preview(@CurrentUser() user: AuthUser, @UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer?.length) throw new BadRequestException('请上传 Excel');
    return this.library.previewMetadata(user, file.buffer);
  }

  @Post('library/metadata-import/confirm')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  confirm(@CurrentUser() user: AuthUser, @UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer?.length) throw new BadRequestException('请上传 Excel');
    return this.library.confirmMetadata(user, file.buffer);
  }

  @Post('library/selection/preview')
  selectionPreview(@CurrentUser() user: AuthUser, @Body(new ZodPipe(selectionPreviewSchema)) body: z.infer<typeof selectionPreviewSchema>) {
    return this.library.selectionPreview(user, body);
  }

  @Post('library/selection/execute')
  selectionExecute(@CurrentUser() user: AuthUser, @Body(new ZodPipe(selectionExecuteSchema)) body: z.infer<typeof selectionExecuteSchema>) {
    return this.library.selectionExecute(user, body);
  }

  @Post('library/selection/export')
  async selectionExport(@CurrentUser() user: AuthUser, @Body(new ZodPipe(selectionExportSchema)) body: z.infer<typeof selectionExportSchema>, @Res() res: Response) {
    const { csv, count } = await this.library.selectionExport(user, body);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dramas-selection.csv"');
    res.setHeader('X-Row-Count', String(count));
    res.send(`\uFEFF${csv}`);
  }
}
