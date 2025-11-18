import { Column, Entity, ManyToMany, ManyToOne, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import FileEntity from '../file/file.entity';
import ProjectEntity from '../project/project.entity';
import UserEntity from '../user/user.entity';

@Entity({ name: 'category' })
@Unique('unique_category_name_per_project', ['name', 'project'])
export default class CategoryEntity extends BaseEntity {
    @Column()
    name!: string;

    @ManyToOne(() => ProjectEntity, (project) => project.categories, {
        onDelete: 'CASCADE',
    })
    project?: ProjectEntity;

    @ManyToMany(() => FileEntity, (file) => file.categories)
    files?: FileEntity[];

    @ManyToOne(() => UserEntity, (user) => user.categories)
    creator?: UserEntity;
}
