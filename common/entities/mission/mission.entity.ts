import IngestionJobEntity from '@common/entities/file/ingestion-job.entity';
import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import ActionEntity from '../action/action.entity';
import ApikeyEntity from '../auth/apikey.entity';
import MissionAccessEntity from '../auth/mission-access.entity';
import BaseEntity from '../base-entity.entity';
import FileEntity from '../file/file.entity';
import MetadataEntity from '../metadata/metadata.entity';
import ProjectEntity from '../project/project.entity';
import UserEntity from '../user/user.entity';

@Unique('unique_mission_name_per_project', ['name', 'project'])
@Entity({ name: 'mission' })
export default class MissionEntity extends BaseEntity {
    @Column()
    name!: string;

    @ManyToOne(() => ProjectEntity, (project) => project.missions, {
        nullable: false,
    })
    project?: ProjectEntity;

    @OneToMany(() => FileEntity, (file) => file.mission)
    files?: FileEntity[];

    @OneToMany(() => ActionEntity, (action) => action.mission)
    actions?: ActionEntity[];

    @OneToMany(() => IngestionJobEntity, (queue) => queue.mission)
    ingestionJobs?: IngestionJobEntity[];

    @ManyToOne(() => UserEntity, (user) => user.missions, { nullable: false })
    creator?: UserEntity;

    @OneToMany(() => ApikeyEntity, (apiKey) => apiKey.mission)
    api_keys?: ApikeyEntity[];

    @OneToMany(
        () => MissionAccessEntity,
        (missionAccess) => missionAccess.mission,
    )
    mission_accesses?: MissionAccessEntity[];

    @OneToMany(() => MetadataEntity, (tag) => tag.mission)
    tags?: MetadataEntity[];

    fileCount?: number;
    size?: number;
}
