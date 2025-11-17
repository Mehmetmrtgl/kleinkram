import { Column, Entity, Generated, ManyToOne, OneToOne } from 'typeorm';
import { AccessGroupRights, KeyTypes } from '../../frontend_shared/enum';
import ActionEntity from '../action/action.entity';
import BaseEntity from '../base-entity.entity';
import MissionEntity from '../mission/mission.entity';
import UserEntity from '../user/user.entity';

@Entity({ name: 'apikey' })
export default class ApikeyEntity extends BaseEntity {
    @Column({ unique: true })
    @Generated('uuid')
    apikey!: string;

    @Column()
    key_type!: KeyTypes;

    @ManyToOne(() => MissionEntity, (mission) => mission.api_keys, {
        onDelete: 'CASCADE',
        eager: true,
    })
    mission!: MissionEntity;

    @OneToOne(() => ActionEntity, (action) => action.key, {
        onDelete: 'CASCADE',
        nullable: true,
    })
    action?: ActionEntity;

    @ManyToOne(() => UserEntity, (user) => user.api_keys, {
        onDelete: 'CASCADE',
    })
    user?: UserEntity;

    @Column()
    rights!: AccessGroupRights;
}
