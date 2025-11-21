import AccessGroupEntity from '@common/entities/auth/accessgroup.entity';
import AccountEntity from '@common/entities/auth/account.entity';
import MetadataEntity from '@common/entities/metadata/metadata.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import ProjectEntity from '@common/entities/project/project.entity';
import TagTypeEntity from '@common/entities/tagType/tag-type.entity';
import { StorageModule } from '@common/modules/storage/storage.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionService } from '../../services/mission.service';
import { TagService } from '../../services/tag.service';
import { UserService } from '../../services/user.service';
import { MissionController } from './mission.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MissionEntity,
            ProjectEntity,
            AccountEntity,
            AccessGroupEntity,
            MetadataEntity,
            TagTypeEntity,
        ]),
        StorageModule,
    ],
    providers: [MissionService, UserService, TagService],
    controllers: [MissionController],
    exports: [MissionService],
})
export class MissionModule {}
