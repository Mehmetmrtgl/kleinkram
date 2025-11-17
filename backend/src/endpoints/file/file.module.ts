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
import QueueEntity from '@common/entities/queue/queue.entity';
import { FileGuardService } from '../../services/file-guard.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MissionEntity,
            FileEntity,
            TopicEntity,
            QueueEntity,
            ProjectEntity,
            AccountEntity,
            AccessGroupEntity,
            MetadataEntity,
            TagTypeEntity,
            CategoryEntity,
        ]),
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
