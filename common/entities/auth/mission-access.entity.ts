import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import MissionEntity from '../mission/mission.entity';
import AccessGroupEntity from './accessgroup.entity';

import { AccessGroupRights } from '../../frontend_shared/enum';

@Entity({ name: 'mission_access' })
@Unique('no_duplicated_access_groups_per_mission', ['accessGroup', 'mission'])
export default class MissionAccessEntity extends BaseEntity {
    @Column()
    rights!: AccessGroupRights;

    @ManyToOne(() => AccessGroupEntity, (group) => group.project_accesses, {
        nullable: false,
    })
    accessGroup?: AccessGroupEntity;

    @ManyToOne(() => MissionEntity, (mission) => mission.mission_accesses, {
        nullable: false,
    })
    mission?: MissionEntity;
}
