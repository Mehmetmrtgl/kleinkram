import AccountEntity from '@common/entities/auth/account.entity';
import ApikeyEntity from '@common/entities/auth/apikey.entity';
import UserEntity from '@common/entities/user/user.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/project-access-view.entity';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from '../../services/user.service';
import { UserController } from './user.controller';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([
            UserEntity,
            ApikeyEntity,
            AccountEntity,
            ProjectAccessViewEntity,
        ]),
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [
        UserService,
        TypeOrmModule.forFeature([
            UserEntity,
            ApikeyEntity,
            ProjectAccessViewEntity,
        ]),
    ],
})
export class UserModule {}
