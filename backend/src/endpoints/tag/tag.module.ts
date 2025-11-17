import AccessGroupEntity from '@common/entities/auth/accessgroup.entity';
import AccountEntity from '@common/entities/auth/account.entity';
import ApikeyEntity from '@common/entities/auth/apikey.entity';
import MetadataEntity from '@common/entities/metadata/metadata.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import ProjectEntity from '@common/entities/project/project.entity';
import TagTypeEntity from '@common/entities/tagType/tag-type.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagService } from '../../services/tag.service';
import { TagController } from './tag.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MetadataEntity,
            TagTypeEntity,
            MissionEntity,
            AccessGroupEntity,
            ProjectEntity,
            AccountEntity,
            ApikeyEntity,
        ]),
    ],
    providers: [TagService],
    controllers: [TagController],
    exports: [TagService],
})
export class TagModule {}
