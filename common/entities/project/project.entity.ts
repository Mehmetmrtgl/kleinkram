import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import ProjectAccessEntity from '../auth/project-access.entity';
import BaseEntity from '../base-entity.entity';
import CategoryEntity from '../category/category.entity';
import MissionEntity from '../mission/mission.entity';
import TagTypeEntity from '../tagType/tag-type.entity';
import UserEntity from '../user/user.entity';

@Entity({ name: 'project' })
export default class ProjectEntity extends BaseEntity {
    /**
     * The name of the project. This is the name that will be displayed in the UI.
     * The name must be globally unique.
     */
    @Column({ unique: true })
    name!: string;

    @OneToMany(() => MissionEntity, (mission) => mission.project)
    missions?: MissionEntity[];
    readonly missionCount?: number;

    @OneToMany(
        () => ProjectAccessEntity,
        (projectAccess) => projectAccess.project,
        {
            cascade: true,
        },
    )
    project_accesses?: ProjectAccessEntity[];

    @Column()
    description!: string;

    @ManyToOne(() => UserEntity, (user) => user.projects, { nullable: false })
    creator?: UserEntity;

    @ManyToMany(() => TagTypeEntity, (tag) => tag.project, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    requiredTags!: TagTypeEntity[];

    @OneToMany(() => CategoryEntity, (category) => category.project)
    categories?: CategoryEntity[];

    @Column({ default: true })
    autoConvert?: boolean;
}
