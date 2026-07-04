import * as userService from '../services/userService.js';

export const createEmployee = async (req, res, next) => {
  try {
    const employee = await userService.createEmployee(req.tenant, req.body);
    res.status(201).json({ success: true, message: 'Employee created successfully', data: employee });
  } catch (error) {
    next(error);
  }
};

export const getEmployees = async (req, res, next) => {
  try {
    const employees = await userService.getEmployees(req.tenant);
    res.status(200).json({ success: true, message: 'Employees retrieved successfully', data: employees });
  } catch (error) {
    next(error);
  }
};
