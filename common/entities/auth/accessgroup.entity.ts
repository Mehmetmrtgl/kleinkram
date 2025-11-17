import {
    Column,
    Entity,
    JoinTable,
    ManyToOne,
    OneToMany,
    Unique,
} from 'typeorm';
import { AccessGroupType } from '../../frontend_shared/enum';
import BaseEntity from '../base-entity.entity';
import UserEntity from '../user/user.entity';
import GroupMembershipEntity from './group-membership.entity';
import MissionAccessEntity from './mission-access.entity';
import ProjectAccessEntity from './project-access.entity';

@Unique('unique_access_group_name', ['name'])
@Entity({ name: 'access_group' })
export default class AccessGroupEntity extends BaseEntity {
    @Column()
    name!: string;

    @OneToMany(
        () => GroupMembershipEntity,
        (membership) => membership.accessGroup,
        {
            cascade: true,
        },
    )
    memberships?: GroupMembershipEntity[];

    @OneToMany(
        () => ProjectAccessEntity,
        (projectAccess) => projectAccess.accessGroup,
    )
    project_accesses?: ProjectAccessEntity[];

    @OneToMany(
        () => MissionAccessEntity,
        (missionAccess) => missionAccess.accessGroup,
    )
    @JoinTable()
    mission_accesses?: MissionAccessEntity[];

    @Column({
        type: 'enum',
        enum: AccessGroupType,
        default: AccessGroupType.CUSTOM,
    })
    type!: AccessGroupType;

    @ManyToOne(() => UserEntity, (user) => user.files, { nullable: true })
    creator?: UserEntity;

    /**
     * A hidden access group is not returned in any search queries.
     * Hidden access groups may still be accessed by referenced by UUID
     * (e.g., when listing groups with access to a project).
     *
     */
    @Column({ default: false })
    hidden!: boolean;
}
