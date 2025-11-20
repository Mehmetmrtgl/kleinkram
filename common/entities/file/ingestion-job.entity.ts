import FileEntity from '@common/entities/file/file.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { FileLocation, QueueState } from '../../frontend_shared/enum';
import BaseEntity from '../base-entity.entity';
import MissionEntity from '../mission/mission.entity';
import UserEntity from '../user/user.entity';

@Entity({ name: 'ingestion_job' })
export default class IngestionJobEntity extends BaseEntity {
    /**
     * The unique identifier of the file.
     *
     * This is the Google Drive ID for files imported from Google Drive or
     * the UUID for file entities created in the system for files uploaded.
     *
     */
    @Column()
    identifier!: string;

    /**
     * The name of the file as displayed to the user in the queue list
     *
     */
    @Column({ default: '' })
    display_name!: string;

    @Column({
        type: 'enum',
        enum: QueueState,
        default: QueueState.AWAITING_UPLOAD,
    })
    state!: QueueState;

    @ManyToOne(() => MissionEntity, (project) => project.ingestionJobs, {
        onDelete: 'CASCADE',
    })
    mission?: MissionEntity;

    @Column({
        type: 'enum',
        enum: FileLocation,
        default: FileLocation.MINIO,
    })
    location!: FileLocation;

    @Column({ nullable: true, default: null })
    processingDuration?: number;

    @ManyToOne(() => UserEntity, (user) => user.queues)
    creator?: UserEntity;

    /**
     * Link to the actual FileEntity once created.
     * This allows us to easily join Queue -> File.
     */
    @ManyToOne(() => FileEntity, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'file_uuid' })
    file?: FileEntity;
}
