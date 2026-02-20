/**
 * Compliance Matrix Component
 * Displays firmware compliance percentages across vendors and data centers
 * Similar to a grid showing compliance status with color-coded indicators
 */

import React from 'react';

export interface ComplianceItem {
  location: string;
  vendors: {
    [vendorName: string]: {
      percentage: number;
      status: 'compliant' | 'warning' | 'critical';
    };
  };
}

interface ComplianceMatrixProps {
  title: string;
  data: ComplianceItem[];
  vendors: string[];
}

export const ComplianceMatrix: React.FC<ComplianceMatrixProps> = ({ title, data, vendors }) => {
  const getStatusColor = (status: 'compliant' | 'warning' | 'critical') => {
    switch (status) {
      case 'compliant':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusDot = (status: 'compliant' | 'warning' | 'critical') => {
    switch (status) {
      case 'compliant':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-900 dark:bg-gray-950">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Location
              </th>
              {vendors.map((vendor) => (
                <th
                  key={vendor}
                  className="px-4 py-3 text-center text-xs font-medium text-white uppercase tracking-wider"
                >
                  {vendor}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((item, index) => (
              <tr
                key={index}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                  {item.location}
                </td>
                {vendors.map((vendor) => {
                  const vendorData = item.vendors[vendor];
                  if (!vendorData) {
                    return (
                      <td
                        key={vendor}
                        className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-400 dark:text-gray-500"
                      >
                        N/A
                      </td>
                    );
                  }
                  return (
                    <td
                      key={vendor}
                      className="px-4 py-4 whitespace-nowrap text-center text-sm"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <span className={`font-semibold ${getStatusColor(vendorData.status)}`}>
                          {vendorData.percentage}%
                        </span>
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${getStatusDot(
                            vendorData.status
                          )}`}
                          title={vendorData.status}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-end space-x-6 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center space-x-2">
          <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
          <span>Compliant (≥90%)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
          <span>Warning (70-89%)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          <span>Critical (&lt;70%)</span>
        </div>
      </div>
    </div>
  );
};
