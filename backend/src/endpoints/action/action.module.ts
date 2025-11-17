import ActionTemplateEntity from '@common/entities/action/action-template.entity';
import ActionEntity from '@common/entities/action/action.entity';
import AccessGroupEntity from '@common/entities/auth/accessgroup.entity';
import AccountEntity from '@common/entities/auth/account.entity';
import MetadataEntity from '@common/entities/metadata/metadata.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import ProjectEntity from '@common/entities/project/project.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionService } from '../../services/action.service';
import { ActionGuardService } from '../auth/action-guard.service';
import { QueueModule } from '../queue/queue.module';
import { ActionController } from './action.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ActionEntity,
            ActionTemplateEntity,
            AccessGroupEntity,
            ProjectEntity,
            MissionEntity,
            AccountEntity,
            MetadataEntity,
        ]),
        QueueModule,
    ],
    providers: [ActionService, ActionGuardService],
    exports: [ActionService],
    controllers: [ActionController],
})
export class ActionModule {}
