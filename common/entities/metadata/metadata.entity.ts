import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import TagType from '../tagType/tag-type.entity';
import User from '../user/user.entity';

// TODO: rename the SQL table from tag to metadata
//   in some early version of kleinkram metadata were named
//   tags, this is a legacy and should be cleaned up at some point
@Entity({ name: 'tag' })
export default class MetadataEntity extends BaseEntity {
    @Column({ nullable: true, name: 'STRING' })
    value_string?: string;

    @Column({ nullable: true, type: 'double precision', name: 'NUMBER' })
    value_number?: number;

    @Column({ nullable: true, name: 'BOOLEAN' })
    value_boolean?: boolean;

    @Column({ nullable: true, name: 'DATE' })
    value_date?: Date;

    @Column({ nullable: true, name: 'LOCATION' })
    value_location?: string;

    @ManyToOne(() => Mission, (mission) => mission.tags, {
        onDelete: 'CASCADE',
    })
    mission?: Mission;

    @ManyToOne(() => TagType, (tagType) => tagType.tags, { eager: true })
    tagType?: TagType;

    @ManyToOne(() => User, (user) => user.tags, {
        onDelete: 'SET NULL',
        nullable: true,
    })
    creator?: User;
}
