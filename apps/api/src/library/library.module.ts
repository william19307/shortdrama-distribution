import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { DistributionModule } from '../distribution/distribution.module';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({ imports: [CatalogModule, DistributionModule], controllers: [LibraryController], providers: [LibraryService] })
export class LibraryModule {}
