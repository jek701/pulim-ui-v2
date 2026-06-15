import React from 'react';
import {useDraggable} from "@dnd-kit/react";
import styles from "./styles.module.css"

export type CategoryColor = "red" | "green" | "blue" | "yellow";

interface CategoryProps {
    name: string;
    icon?: React.ReactNode;
    currentBalance: string;
    id: string;
    backgroundColor?: CategoryColor;
}

const Category: React.FC<CategoryProps> = ({name, id, currentBalance, icon, backgroundColor}) => {
    const {ref} = useDraggable({
        id: id
    })
    return (
        <div className={styles.category}>
            <p>{name}</p>
            <span className={styles.categoryBackground} style={{
                backgroundColor: backgroundColor
            }} ref={ref}>{icon}</span>
            <p>{currentBalance}</p>
        </div>
    );
};

export default Category;