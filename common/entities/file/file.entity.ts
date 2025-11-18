import {
    Column,
    Entity,
    JoinColumn,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    OneToOne,
    Unique,
} from 'typeorm';
import { FileOrigin, FileState, FileType } from '../../frontend_shared/enum';
import BaseEntity from '../base-entity.entity';
import CategoryEntity from '../category/category.entity';
import MissionEntity from '../mission/mission.entity';
import TopicEntity from '../topic/topic.entity';
import UserEntity from '../user/user.entity';

@Entity({ name: 'file_entity' })
@Unique('unique_file_name_per_mission', ['filename', 'mission'])
export default class FileEntity extends BaseEntity {
    @ManyToOne(() => MissionEntity, (mission) => mission.files, {
        nullable: false,
    })
    mission?: MissionEntity;

    @Column()
    date!: Date;

    @OneToMany(() => TopicEntity, (topic) => topic.file)
    topics?: TopicEntity[];

    @Column()
    filename!: string;

    @Column({
        type: 'bigint',
        transformer: {
            to: (value: number) => value,
            from: (value: string) => Number.parseInt(value, 10),
        },
    })
    size?: number;

    /**
     * The user who uploaded the file.
     */
    @ManyToOne(() => UserEntity, (user) => user.files, { nullable: false })
    creator?: UserEntity;

    @Column()
    type!: FileType;

    @Column({ default: FileState.OK })
    state!: FileState;

    @Column({ nullable: true })
    hash?: string;

    @ManyToMany(() => CategoryEntity, (category) => category.files)
    @JoinTable()
    categories?: CategoryEntity[];

    /**
     * Saves the reference to the bag or mcap file the current file was converted
     * to or from. May be null if the file was not converted or the reference is
     * not available.
     */
    @OneToOne(() => FileEntity, (file) => file.relatedFile, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'related_file_uuid' })
    relatedFile?: FileEntity;

    @Column({ nullable: true })
    origin?: FileOrigin;
}
