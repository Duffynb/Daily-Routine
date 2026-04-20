import React, { Component } from 'react';
import TodoPage from './TodoPage.jsx';
import DaylogPage from './DaylogPage.jsx';
import FoodTrackingPage from './FoodTrackingPage.jsx';
import SpendlogPage from './SpendlogPage.jsx';

export default class LifeManagerPage extends Component {
  render() {
    const {
      todoItems,
      onTodoItemsChange,
      daylogItems,
      daylogHourlyRate,
      onDaylogItemsChange,
      onDaylogHourlyRateChange,
      foodEntries,
      foodBurnEntries,
      calorieGoal,
      onFoodEntriesChange,
      onFoodBurnEntriesChange,
      onCalorieGoalChange,
      spendEntries,
      onSpendEntriesChange,
    } = this.props;

    return (
      <div className="life-manager-root">
        <h2 className="life-manager-title">Life manager (experiment)</h2>
        <div className="life-manager-grid">
          <section className="life-tile">
            <TodoPage items={todoItems} onItemsChange={onTodoItemsChange} />
          </section>

          <section className="life-tile">
            <DaylogPage
              items={daylogItems}
              spendItems={spendEntries}
              hourlyRate={daylogHourlyRate}
              onHourlyRateChange={onDaylogHourlyRateChange}
              onItemsChange={onDaylogItemsChange}
            />
          </section>

          <section className="life-tile">
            <FoodTrackingPage
              items={foodEntries}
              burnItems={foodBurnEntries}
              calorieGoal={calorieGoal}
              onItemsChange={onFoodEntriesChange}
              onBurnItemsChange={onFoodBurnEntriesChange}
              onGoalChange={onCalorieGoalChange}
            />
          </section>

          <section className="life-tile">
            <SpendlogPage items={spendEntries} onItemsChange={onSpendEntriesChange} />
          </section>
        </div>
      </div>
    );
  }
}
