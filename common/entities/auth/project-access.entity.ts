import { Column, Entity, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import ProjectEntity from '../project/project.entity';
import AccessGroupEntity from './accessgroup.entity';

import { AccessGroupRights } from '../../frontend_shared/enum';

@Unique('no_duplicated_access_groups_per_project', ['accessGroup', 'project'])
@Entity({ name: 'project_access' })
export default class ProjectAccessEntity extends BaseEntity {
    @Column()
    rights!: AccessGroupRights;

    @ManyToOne(() => AccessGroupEntity, (group) => group.project_accesses, {
        nullable: false,
    })
    accessGroup?: AccessGroupEntity;

    @ManyToOne(() => ProjectEntity, (project) => project.project_accesses, {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        nullable: false,
    })
    project?: ProjectEntity;
}
