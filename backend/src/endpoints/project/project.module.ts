import AccessGroupEntity from '@common/entities/auth/accessgroup.entity';
import AccountEntity from '@common/entities/auth/account.entity';
import ProjectAccessEntity from '@common/entities/auth/project-access.entity';
import ProjectEntity from '@common/entities/project/project.entity';
import TagTypeEntity from '@common/entities/tagType/tag-type.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessService } from '../../services/access.service';
import { ProjectService } from '../../services/project.service';
import { OldProjectController, ProjectController } from './project.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ProjectEntity,
            AccountEntity,
            AccessGroupEntity,
            TagTypeEntity,
            ProjectAccessEntity,
        ]),
    ],
    providers: [ProjectService, AccessService],
    exports: [ProjectService],
    controllers: [ProjectController, OldProjectController],
})
export class ProjectModule {}
