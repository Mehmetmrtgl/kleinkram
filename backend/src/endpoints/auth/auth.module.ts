import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from '../../services/auth.service';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { AdminOnlyGuard, LoggedInUserGuard } from './roles.guard';

import AccessGroupEntity from '@common/entities/auth/accessgroup.entity';
import AccountEntity from '@common/entities/auth/account.entity';
import GroupMembershipEntity from '@common/entities/auth/group-membership.entity';
import MissionAccessEntity from '@common/entities/auth/mission-access.entity';
import ProjectAccessEntity from '@common/entities/auth/project-access.entity';
import FileEntity from '@common/entities/file/file.entity';
import MetadataEntity from '@common/entities/metadata/metadata.entity';
import MissionEntity from '@common/entities/mission/mission.entity';
import ProjectEntity from '@common/entities/project/project.entity';
import env from '@common/environment';
import { MissionAccessViewEntity } from '@common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/project-access-view.entity';
import { AccessService } from '../../services/access.service';
import { ProjectGuardService } from '../../services/project-guard.service';
import { AccessController } from './access.controller';
import { AuthGuardService } from './auth-guard.service';
import { FakeOauthStrategy } from './fake-oauth.strategy';
import { GitHubStrategy } from './github.strategy';
import { MissionGuardService } from './mission-guard.service';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([
            AccessGroupEntity,
            AccountEntity,
            ProjectEntity,
            MissionEntity,
            MetadataEntity,
            ProjectAccessEntity,
            MissionAccessEntity,
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
            FileEntity,
            GroupMembershipEntity,
        ]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            useFactory: () => ({
                secret: env.JWT_SECRET,
                signOptions: { expiresIn: '60m' },
            }),
        }),
    ],
    providers: [
        AuthService,
        AccessService,
        GoogleStrategy,
        GitHubStrategy,
        FakeOauthStrategy,
        ProjectGuardService,
        MissionGuardService,
        AuthGuardService,
        JwtStrategy,
        AdminOnlyGuard,
        LoggedInUserGuard,
    ],
    controllers: [AuthController, AccessController],
    exports: [
        AdminOnlyGuard,
        LoggedInUserGuard,
        ProjectGuardService,
        MissionGuardService,
        TypeOrmModule.forFeature([
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
        ]),
    ],
})
export class AuthModule {}
