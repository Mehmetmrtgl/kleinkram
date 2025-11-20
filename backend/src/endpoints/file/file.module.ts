import FileEntity from '@common/entities/file/file.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import ProjectEntity from '@common/entities/project/project.entity';
import TopicEntity from '@common/entities/topic/topic.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileService } from '../../services/file.service';
import { TopicService } from '../../services/topic.service';
import { FileController } from './file.controller';

import AccessGroupEntity from '@common/entities/auth/accessgroup.entity';
import AccountEntity from '@common/entities/auth/account.entity';
import MetadataEntity from '@common/entities/metadata/metadata.entity';
import TagTypeEntity from '@common/entities/tagType/tag-type.entity';
import { MissionService } from '../../services/mission.service';
import { TagService } from '../../services/tag.service';

import CategoryEntity from '@common/entities/category/category.entity';
import FileEventEntity from '@common/entities/file/file-event.entity';
import IngestionJobEntity from '@common/entities/file/ingestion-job.entity';
import { StorageModule } from '@common/modules/storage/storage.module';
import { FileGuardService } from '../../services/file-guard.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MissionEntity,
            FileEntity,
            TopicEntity,
            IngestionJobEntity,
            ProjectEntity,
            AccountEntity,
            AccessGroupEntity,
            MetadataEntity,
            TagTypeEntity,
            CategoryEntity,
            FileEventEntity,
        ]),
        StorageModule,
    ],
    providers: [
        FileService,
        TopicService,
        MissionService,
        FileGuardService,
        TagService,
    ],
    controllers: [FileController],
    exports: [FileService],
})
export class FileModule {}
