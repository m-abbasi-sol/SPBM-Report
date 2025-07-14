// report_app.js
// This file contains the main React application logic for the bandwidth report.

// Destructure React hooks from the global React object
const { useState, useEffect, useRef, useMemo } = React;

// Set default font family for Chart.js and customize tooltip/axis labels for Persian digits
Chart.defaults.font.family = 'Vazir';
Chart.defaults.plugins.tooltip.callbacks.label = (context) => {
    let label = context.dataset.label || '';
    if (label) { label += ': '; }
    if (context.parsed.y !== null) { label += toPersianDigits(context.parsed.y); }
    return label;
};
Chart.defaults.scales.linear.ticks.callback = (value) => toPersianDigits(value);

// Helper function to format bytes to MB or GB
function formatBytesToReadable(mbValue) {
    if (mbValue >= 1024) {
        return toPersianDigits((mbValue / 1024).toFixed(2)) + ' GB';
    }
    return toPersianDigits(mbValue.toFixed(2)) + ' MB';
}

// MessageBox Component
function MessageBox({ message, onClose }) {
    if (!message) {
        // console.log("MessageBox: message is null, not rendering."); // Keep this for debugging if needed
        return null;
    }
    console.log("MessageBox: Rendering with message:", message.text);

    const messageClass = message.type === 'warning' ? 'warning' : ''; 

    return React.createElement('div', { className: 'message-box-overlay ' + (message ? 'visible' : '') },
        React.createElement('div', { className: 'message-box-content' },
            React.createElement('button', { className: 'message-box-close', onClick: onClose }, '×'),
            React.createElement('p', { className: 'message-box-text ' + messageClass }, message.text)
        )
    );
}

// Main App Component
function App({ setMessage, message }) { 
    // console.log("App Component Rendered."); // Log every time App renders
    const rawData = window.reportData || null; 
    const [selectedView, setSelectedView] = useState('کلی');
    const [chartType, setChartType] = useState('bar'); 
    const chartInstanceRef = useRef(null);

    const startDateInputRef = useRef(null);
    const endDateInputRef = useRef(null);

    const [displayStartDate, setDisplayStartDate] = useState('');
    const [displayEndDate, setDisplayEndDate] = useState('');

    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    // Setting predefinedRange default to 'month' for dropdown consistency
    const [predefinedRange, setPredefinedRange] = useState('month'); 

    const [sortOrder, setSortOrder] = useState({ column: null, direction: null });
    
    const [monthlyReportData, setMonthlyReportData] = useState([]);
    const [quarterlyReportData, setQuarterlyReportData] = useState([]);
    const [showMonthlyHighestChart, setShowMonthlyHighestChart] = useState(false); // New state for toggling monthly charts

    // Define color palettes for charts as regular constants
    const springPalette = ['#69F0AE', '#00C853', '#00A040']; // Lighter, Main, Darker
    const summerPalette = ['#FFC107', '#FF9800', '#EF6C00']; // Lighter, Main, Darker
    const autumnPalette = ['#FF8A65', '#FF5722', '#D84315']; // Lighter, Main, Darker
    const winterPalette = ['#64B5F6', '#2196F3', '#1565C0']; // Lighter, Main, Darker

    const monthlyColors = {
        'فروردین': springPalette[0], 'اردیبهشت': springPalette[1], 'خرداد': springPalette[2],
        'تیر': summerPalette[0], 'مرداد': summerPalette[1], 'شهریور': summerPalette[2],
        'مهر': autumnPalette[0], 'آبان': autumnPalette[1], 'آذر': autumnPalette[2],
        'دی': winterPalette[0], 'بهمن': winterPalette[1], 'اسفند': winterPalette[2],
    };

    const quarterlyColors = {
        'بهار': '#4CAF50', // Vibrant Green
        'تابستان': '#FF9800', // Warm Orange
        'پاییز': '#FFC107', // Deep Golden Yellow
        'زمستان': '#2196F3', // Cool Blue
    };

    const chartColors = { monthlyColors, quarterlyColors }; // Combine into one object


    useEffect(() => {
        if (rawData) {
            console.log("App: rawData loaded in useEffect. RawData:", rawData); 
            console.log("rawData.users.length (from PowerShell data):", rawData.users ? rawData.users.length : 'null/undefined'); 
            console.log("rawData Min Date:", rawData.dateRange.startDate);
            console.log("rawData Max Date:", rawData.dateRange.endDate);

            const todayGreg = new Date(); 
            
            const initialStartDate = getShamsiMonthStart(); 
            const initialEndDate = todayGreg.toISOString().slice(0, 10);

            console.log("Calculated Initial Shamsi Month Start (Gregorian):", initialStartDate); 
            console.log("Calculated Initial Shamsi Month End (today Gregorian):", initialEndDate); 

            const minAllowedDate = rawData.dateRange.startDate;
            const maxAllowedDate = rawData.dateRange.endDate;

            const clampedStartDate = (new Date(initialStartDate) >= new Date(minAllowedDate)) ? initialStartDate : minAllowedDate;
            const clampedEndDate = (new Date(initialEndDate) <= new Date(maxAllowedDate)) ? initialEndDate : maxAllowedDate;


            setDisplayStartDate(clampedStartDate);
            setDisplayEndDate(clampedEndDate);
            setAppliedStartDate(clampedStartDate); 
            setAppliedEndDate(clampedEndDate);     
            
            console.log("App: Final Clamped Display/Applied Dates:", { clampedStartDate, clampedEndDate });

            setMonthlyReportData(calculateMonthlyReport(rawData));
            setQuarterlyReportData(calculateQuarterlyReport(rawData));
        } else {
             console.log("App: rawData is null or undefined initially in useEffect.");
        }
    }, [rawData]);

    const calculateMonthlyReport = (data) => {
        if (!data || !data.users) return [];

        const monthlyTotals = {};
        const monthlyDaysCount = {};

        data.users.forEach(user => {
            user.dailyData.forEach(dayData => {
                const date = new Date(dayData.day);
                const year = date.getFullYear();
                const month = date.getMonth() + 1;

                const monthKey = `${year}-${month < 10 ? '0' + month : month}`;

                if (!monthlyTotals[monthKey]) {
                    monthlyTotals[monthKey] = { totalUsage: 0, totalDownload: 0, totalUpload: 0 };
                    monthlyDaysCount[monthKey] = new Set();
                }

                monthlyTotals[monthKey].totalUsage += dayData.totalUsage;
                monthlyTotals[monthKey].totalDownload += dayData.download;
                monthlyTotals[monthKey].totalUpload += dayData.upload;
                monthlyDaysCount[monthKey].add(dayData.day);
            });
        });

        const report = Object.keys(monthlyTotals).map(monthKey => {
            const [year, month] = monthKey.split('-').map(Number);
            const gregorianDate = new Date(year, month - 1, 1);
            const shamsiDateParts = formatShamsiDate(gregorianDate.toISOString().slice(0, 10)).split('/'); 
            
            // Ensure shamsiMonthNum is always a valid number
            const shamsiMonthNum = shamsiDateParts[1] ? parseInt(shamsiDateParts[1], 10) : 1; 

            const highestConsumerData = data.monthlyHighestConsumers?.[monthKey] || { userName: 'نامشخص', totalUsage: 0 };

            return {
                monthKey,
                shamsiMonth: shamsiMonthNum,
                daysCount: monthlyDaysCount[monthKey].size,
                totalUsage: parseFloat(monthlyTotals[monthKey].totalUsage.toFixed(2)),
                totalDownload: parseFloat(monthlyTotals[monthKey].totalDownload.toFixed(2)),
                totalUpload: parseFloat(monthlyTotals[monthKey].totalUpload.toFixed(2)),
                highestConsumer: highestConsumerData.userName,
                highestConsumerUsage: parseFloat(highestConsumerData.totalUsage.toFixed(2))
            };
        });

        report.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
        
        const persianMonthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
        return report.map(item => {
            item.shamsiMonthName = persianMonthNames[item.shamsiMonth - 1];
            return item;
        });
    };

    const calculateQuarterlyReport = (data) => {
        if (!data || !data.users) return [];

        const quarterlyTotals = {}; 
        const quarterlyDaysCount = {};

        const shamsiMonthToQuarter = {
            1: 1, 2: 1, 3: 1, 
            4: 2, 5: 2, 6: 2, 
            7: 3, 8: 3, 9: 3, 
            10: 4, 11: 4, 12: 4 
        };

        const quarterNames = {
            1: "بهار",
            2: "تابستان",
            3: "پاییز",
            4: "زمستان"
        };

        data.users.forEach(user => {
            user.dailyData.forEach(dayData => {
                const gregorianDate = new Date(dayData.day);
                const shamsiDate = toShamsi(gregorianDate.getFullYear(), gregorianDate.getMonth() + 1, gregorianDate.getDate());
                const shamsiYear = shamsiDate[0];
                const shamsiMonth = shamsiDate[1];
                
                const quarterNum = shamsiMonthToQuarter[shamsiMonth];
                const quarterKey = `${shamsiYear}-${quarterNum}`;

                if (!quarterlyTotals[quarterKey]) { 
                    quarterlyTotals[quarterKey] = { totalUsage: 0, totalDownload: 0, totalUpload: 0 };
                    quarterlyDaysCount[quarterKey] = new Set();
                }

                quarterlyTotals[quarterKey].totalUsage += dayData.totalUsage; 
                quarterlyTotals[quarterKey].totalDownload += dayData.download; 
                quarterlyTotals[quarterKey].totalUpload += dayData.upload; 
                quarterlyDaysCount[quarterKey].add(dayData.day);
            });
        });

        const report = Object.keys(quarterlyTotals).map(quarterKey => { 
            const [shamsiYear, quarterNum] = quarterKey.split('-').map(Number);
            
            return {
                quarterKey,
                shamsiYear,
                quarterNum,
                quarterName: quarterNames[quarterNum],
                daysCount: quarterlyDaysCount[quarterKey].size,
                totalUsage: parseFloat(quarterlyTotals[quarterKey].totalUsage.toFixed(2)), 
                totalDownload: parseFloat(quarterlyTotals[quarterKey].totalDownload.toFixed(2)), 
                totalUpload: parseFloat(quarterlyTotals[quarterKey].totalUpload.toFixed(2)), 
            };
        });

        report.sort((a, b) => a.quarterKey.localeCompare(b.quarterKey));
        return report;
    };


    const filterDataByDateRange = (dataToFilter, start, end) => {
        console.log("filterDataByDateRange: Input dataToFilter.users.length:", dataToFilter.users ? dataToFilter.users.length : 'null/undefined'); 
        console.log("filterDataByDateRange: Filtering for range:", { start, end }); 

        if (!dataToFilter || !dataToFilter.users || !Array.isArray(dataToFilter.users) || !start || !end) {
            console.log("filterDataByDateRange: Invalid input or empty dataToFilter.users, returning empty structure."); 
            return { users: [], dateRange: { startDate: start, endDate: end }, monthlyHighestConsumers: {} };
        }

        const startDateObj = new Date(start + 'T00:00:00Z'); // IMPORTANT: Add 'Z' for UTC
        const endDateObj = new Date(end + 'T23:59:59Z');   // IMPORTANT: Add 'Z' for UTC
        console.log("filterDataByDateRange: startDateObj (ISO):", startDateObj.toISOString()); 
        console.log("filterDataByDateRange: endDateObj (ISO):", endDateObj.toISOString()); 

        const filteredUsers = dataToFilter.users.map(user => {
            const filteredDailyData = user.dailyData.filter(d => {
                const dailyDate = new Date(d.day + 'T00:00:00Z'); // IMPORTANT: Add 'Z' for UTC
                const isWithinRange = dailyDate >= startDateObj && dailyDate <= endDateObj;
                console.log(`  User: ${user.name}, Raw Day: ${d.day}, DailyDate (ISO): ${dailyDate.toISOString()}, Within Range: ${isWithinRange}`); 
                return isWithinRange;
            });
            console.log(`User: ${user.name}, Filtered Daily Data Count: ${filteredDailyData.length}`); 

            let totalDownload = 0;
            let totalUpload = 0;
            let totalUsage = 0;
            filteredDailyData.forEach(d => {
                totalDownload += d.download;
                totalUpload += d.upload;
                totalUsage += d.totalUsage;
            });

            return {
                ...user,
                dailyData: filteredDailyData,
                summary: {
                    totalDownload: parseFloat(totalDownload.toFixed(2)),
                    totalUpload: parseFloat(totalUpload.toFixed(2)),
                    totalUsage: parseFloat(totalUsage.toFixed(2))
                }
            };
        }).filter(user => user.dailyData.length > 0); 

        let actualStartDate = start;
        let actualEndDate = end;
        if (filteredUsers.length > 0) {
            const allDailyDates = filteredUsers.flatMap(u => u.dailyData.map(d => new Date(d.day).getTime()));
            if (allDailyDates.length > 0) {
                actualStartDate = new Date(Math.min(...allDailyDates)).toISOString().slice(0, 10);
                actualEndDate = new Date(Math.max(...allDailyDates)).toISOString().slice(0, 10);
            }
        }
        console.log("filterDataByDateRange: Returning filtered data (users count):", filteredUsers.length); 
        return {
            users: filteredUsers,
            dateRange: { startDate: actualStartDate, endDate: actualEndDate },
            monthlyHighestConsumers: dataToFilter.monthlyHighestConsumers 
        };
    };

    const filteredReportData = useMemo(() => {
        return rawData ? filterDataByDateRange(rawData, appliedStartDate, appliedEndDate) : null;
    }, [rawData, appliedStartDate, appliedEndDate]);

    const sortedUsers = useMemo(() => {
        if (!filteredReportData || !filteredReportData.users) {
            return [];
        }

        const usersToSort = [...filteredReportData.users];

        if (sortOrder.column === 'totalUsage') {
            usersToSort.sort((a, b) => {
                const valA = a.summary.totalUsage;
                const valB = b.summary.totalUsage;
                if (sortOrder.direction === 'asc') {
                    return valA - valB;
                } else {
                    return valB - vA;
                }
            });
        } else {
            usersToSort.sort((a, b) => a.userId.localeCompare(b.userId));
        }
        return usersToSort;
    }, [filteredReportData, sortOrder]);

    const currentUser = useMemo(() => {
        return filteredReportData && filteredReportData.users
            ? filteredReportData.users.find(u => u.name === selectedView)
            : null;
    }, [filteredReportData, selectedView]);

    const maxTotalUsageSummary = useMemo(() => {
        if (!sortedUsers || sortedUsers.length === 0) return 0;
        return Math.max(...sortedUsers.map(user => user.summary.totalUsage));
    }, [sortedUsers]);

    const maxTotalDailyUsage = useMemo(() => {
        if (!currentUser || !currentUser.dailyData || currentUser.dailyData.length === 0) return 0;
        return Math.max(...currentUser.dailyData.map(d => d.totalUsage));
    }, [currentUser]);

    // Calculate total usage for summary table (all users combined)
    const totalSummaryUsage = useMemo(() => {
        let totalDownload = 0;
        let totalUpload = 0;
        let totalUsage = 0;
        if (sortedUsers && sortedUsers.length > 0) {
            sortedUsers.forEach(user => {
                totalDownload += user.summary.totalDownload;
                totalUpload += user.summary.totalUpload;
                totalUsage += user.summary.totalUsage;
            });
        }
        return { totalDownload: parseFloat(totalDownload.toFixed(2)), totalUpload: parseFloat(totalUpload.toFixed(2)), totalUsage: parseFloat(totalUsage.toFixed(2)) };
    }, [sortedUsers]);

    // Calculate total usage for monthly report table
    const totalMonthlyUsage = useMemo(() => {
        let totalDownload = 0;
        let totalUpload = 0;
        let totalUsage = 0;
        if (monthlyReportData && monthlyReportData.length > 0) {
            monthlyReportData.forEach(item => {
                totalDownload += item.totalDownload;
                totalUpload += item.totalUpload;
                totalUsage += item.totalUsage;
            });
        }
        return { totalDownload: parseFloat(totalDownload.toFixed(2)), totalUpload: parseFloat(totalUpload.toFixed(2)), totalUsage: parseFloat(totalUsage.toFixed(2)) };
    }, [monthlyReportData]);

    // Calculate total usage for quarterly report table
    const totalQuarterlyUsage = useMemo(() => {
        let totalDownload = 0;
        let totalUpload = 0;
        let totalUsage = 0;
        if (quarterlyReportData && quarterlyReportData.length > 0) {
            quarterlyReportData.forEach(item => {
                totalDownload += item.totalDownload;
                totalUpload += item.totalUpload;
                totalUsage += item.totalUsage;
            });
        }
        return { totalDownload: parseFloat(totalDownload.toFixed(2)), totalUpload: parseFloat(totalUpload.toFixed(2)), totalUsage: parseFloat(totalUsage.toFixed(2)) };
    }, [quarterlyReportData]);


    const data = filteredReportData;

    // Handler for predefined date range selection
    const handlePredefinedRangeChange = (e) => {
        const range = e.target.value;
        const todayGreg = new Date().toISOString().slice(0, 10);
        let start = todayGreg;
        let end = todayGreg;

        console.log(`handlePredefinedRangeChange: Selected range: ${range}`); 

        switch (range) {
            case 'week':
                start = getShamsiWeekStart();
                break;
            case 'month':
                start = getShamsiMonthStart();
                break;
            case '3months':
                start = getShamsiMonthsAgoStart(2);
                break;
            case '6months':
                start = getShamsiMonthsAgoStart(5);
                break;
            default:
                break;
        }
        console.log(`handlePredefinedRangeChange: Calculated Start: ${start}, End: ${end}`); 

        setPredefinedRange(range);
        setDisplayStartDate(start);
        setDisplayEndDate(end);
        // Automatically apply filter after changing predefined range
        handleApplyFilter(start, end); // Pass calculated start/end directly
    };


    useEffect(() => {
        console.log("App useEffect (renderChartsAndTables) triggered."); 
        console.log("Current filteredReportData in useEffect:", filteredReportData); 

        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }

        const isSummaryOrIndividualView = selectedView === 'کلی' || (data && data.users && data.users.some(u => u.name === selectedView));
        
        // --- Start of Message Logic ---
        let hasDataToDisplay = false;
        if (selectedView === 'کلی' && filteredReportData && filteredReportData.users && filteredReportData.users.length > 0) {
            hasDataToDisplay = true;
        } else if (selectedView !== 'کلی' && selectedView !== 'گزارش ماهانه' && selectedView !== 'گزارش فصلی' && currentUser && currentUser.dailyData && currentUser.dailyData.length > 0) {
            hasDataToDisplay = true;
        } else if (selectedView === 'گزارش ماهانه' && monthlyReportData.length > 0) {
            hasDataToDisplay = true;
        } else if (selectedView === 'گزارش فصلی' && quarterlyReportData.length > 0) {
            hasDataToDisplay = true;
        }

        // Check if the current message state already reflects "no data"
        const isCurrentlyNoDataMessage = message && message.text === 'هیچ داده‌ای برای بازه زمانی انتخابی شما یا پس از اعمال فیلترها پیدا شد.' && message.type === 'warning';

        if (!hasDataToDisplay) {
            // Set message only if it's not already the "no data" message
            if (!isCurrentlyNoDataMessage) {
                setMessage({ text: 'هیچ داده‌ای برای بازه زمانی انتخابی شما یا پس از اعمال فیلترها پیدا شد.', type: 'warning' });
                console.log("App: No data for charts/tables. Setting message."); 
            }
            // If there's no data, we should not proceed to render charts.
            return; 
        } else { // hasDataToDisplay is true
            // Clear message only if a message is currently displayed
            if (message !== null) {
                setMessage(null);
                console.log("App: Data found. Clearing message."); 
            }
        }
        // --- End of Message Logic ---
        
        console.log("App: Data found. Proceeding to render charts/tables."); 

        const renderChartsAndTables = () => {
            if (selectedView === 'کلی') {
                const ctx = document.getElementById('summaryChart')?.getContext('2d');
                if (ctx) {
                    chartInstanceRef.current = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: sortedUsers.map(u => u.name),
                            datasets: [
                                { label: 'آپلود (MB)', data: sortedUsers.map(u => u.summary.totalDownload), backgroundColor: '#4CAF50' },
                                { label: 'دانلود (MB)', data: sortedUsers.map(u => u.summary.totalUpload), backgroundColor: '#2196F3' },
                                { label: 'مجموع (MB)', data: sortedUsers.map(u => u.summary.totalUsage), backgroundColor: '#FF9800' }
                            ]
                        },
                        options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { title: { display: true, text: 'گزارش کلی مصرف اینترنت', font: { size: 18 } } } }
                    });
                    console.log("App: Summary Chart Rendered.");
                }
            } else if (selectedView === 'گزارش ماهانه') {
                const ctx = document.getElementById('monthlyChart')?.getContext('2d');
                if (ctx && monthlyReportData.length > 0) {
                    if (showMonthlyHighestChart) {
                        // Render Highest Usage Per Month Chart
                        chartInstanceRef.current = new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: monthlyReportData.map(item => item.shamsiMonthName),
                                datasets: [{
                                    label: 'مصرف کاربر پرمصرف (MB)',
                                    data: monthlyReportData.map(item => item.highestConsumerUsage),
                                    backgroundColor: '#DC2626', // Red color for highest consumer
                                    borderColor: '#991B1B',
                                    borderWidth: 1
                                }]
                            },
                            options: { 
                                responsive: true, 
                                scales: { y: { beginAtZero: true } }, 
                                plugins: { 
                                    title: { display: true, text: 'نمودار مصرف کاربر پرمصرف ماهیانه', font: { size: 18 } },
                                    tooltip: {
                                        callbacks: {
                                            label: (context) => {
                                                let label = context.dataset.label || '';
                                                if (label) { label += ': '; }
                                                if (context.parsed.y !== null) { label += toPersianDigits(context.parsed.y); }
                                                const highestConsumerName = monthlyReportData[context.dataIndex]?.highestConsumer || '';
                                                return [label, `کاربر: ${highestConsumerName}`];
                                            }
                                        }
                                    }
                                } 
                            }
                        });
                        console.log("App: Monthly Highest Usage Chart Rendered.");
                    } else {
                        // Render Total Monthly Usage Chart
                        const backgroundColors = monthlyReportData.map(item => chartColors.monthlyColors[item.shamsiMonthName]);
                        chartInstanceRef.current = new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: monthlyReportData.map(item => item.shamsiMonthName),
                                datasets: [{
                                    label: 'مجموع مصرف ماهیانه (MB)',
                                    data: monthlyReportData.map(item => item.totalUsage),
                                    backgroundColor: backgroundColors,
                                    borderColor: backgroundColors.map(color => color.replace('0.6', '1')), // Use full opacity for border
                                    borderWidth: 1
                                }]
                            },
                            options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { title: { display: true, text: 'نمودار مجموع مصرف ماهیانه', font: { size: 18 } } } }
                        });
                        console.log("App: Monthly Chart Rendered.");
                    }
                } else {
                    console.log("App: Monthly Report View - No Chart. Data missing or already handled.");
                }
            } else if (selectedView === 'گزارش فصلی') {
                const ctx = document.getElementById('quarterlyChart')?.getContext('2d');
                if (ctx && quarterlyReportData.length > 0) {
                    const backgroundColors = quarterlyReportData.map(item => chartColors.quarterlyColors[item.quarterName]);
                    chartInstanceRef.current = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: quarterlyReportData.map(item => `${item.quarterName} ${toPersianDigits(item.shamsiYear)}`),
                            datasets: [{
                                label: 'مجموع مصرف فصلی (MB)',
                                data: quarterlyReportData.map(item => item.totalUsage),
                                backgroundColor: backgroundColors,
                                borderColor: backgroundColors.map(color => color.replace('0.6', '1')), // Use full opacity for border
                                borderWidth: 1
                            }]
                        },
                        options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { title: { display: true, text: 'نمودار مجموع مصرف فصی', font: { size: 18 } } } }
                    });
                    console.log("App: Quarterly Chart Rendered.");
                } else {
                    console.log("App: Quarterly Report View - No Chart. Data missing or already handled.");
                }
            } else { // Individual user view
                if (currentUser && currentUser.dailyData.length > 0) { 
                    const ctx = document.getElementById('userChart')?.getContext('2d');
                    if (ctx) {
                        chartInstanceRef.current = new Chart(ctx, {
                            type: chartType,
                            data: {
                                labels: currentUser.dailyData.map(d => formatShamsiDate(d.day)),
                                datasets: [{
                                    label: 'مجموع مصرف روزانه (MB)',
                                    data: currentUser.dailyData.map(d => d.totalUsage),
                                    backgroundColor: chartType === 'bar' ? 'rgba(75, 192, 192, 0.6)' : 'transparent',
                                    borderColor: 'rgba(75, 192, 192, 1)',
                                    borderWidth: chartType === 'bar' ? 1 : 2,
                                    fill: chartType === 'line',
                                    tension: 0.1,
                                    pointBackgroundColor: 'rgba(75, 192, 192, 1)'
                                }]
                            },
                            options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { title: { display: true, text: 'نمودار مصرف برای ' + selectedView, font: { size: 18 } } } }
                        });
                        console.log("App: User Chart Rendered."); 
                    }
                } else {
                    // This message should now be handled by the central message logic at the top of useEffect
                }
            }
        };
        renderChartsAndTables();
    }, [selectedView, filteredReportData, chartType, appliedStartDate, appliedEndDate, sortedUsers, maxTotalUsageSummary, maxTotalDailyUsage, currentUser, monthlyReportData, quarterlyReportData, totalSummaryUsage, totalMonthlyUsage, totalQuarterlyUsage, chartColors, showMonthlyHighestChart, message]); // message is a dependency

    const handleApplyFilter = (overrideStart, overrideEnd) => { // Accept optional overrides
        const todayGreg = new Date().toISOString().slice(0, 10);
        let start = overrideStart; // Use override if provided
        let end = overrideEnd;     // Use override if provided

        console.log(`handleApplyFilter: Called with overrideStart: ${overrideStart}, overrideEnd: ${overrideEnd}`); // NEW LOG

        // If no overrides are provided (e.g., button click), use current display dates
        if (typeof overrideStart === 'undefined' || typeof overrideEnd === 'undefined') {
            start = displayStartDate;
            end = displayEndDate;
            console.log(`handleApplyFilter: No overrides, using display dates: ${start}, ${end}`); // NEW LOG
        }


        if (!start || !end || new Date(start) > new Date(end)) {
            console.log(`handleApplyFilter: Invalid date range detected: ${start} to ${end}. Reverting to predefined range.`); // NEW LOG

            switch (predefinedRange) {
                case 'week':
                    start = getShamsiWeekStart();
                    break;
                case 'month':
                    start = getShamsiMonthStart();
                    break;
                case '3months':
                    start = getShamsiMonthsAgoStart(2);
                    break;
                case '6months':
                    start = getShamsiMonthsAgoStart(5);
                    break;
                default:
                    start = getShamsiMonthStart(); 
                    break;
            }
            end = todayGreg;
            setDisplayStartDate(start);
            setDisplayEndDate(end);
        }

        console.log("App: Apply Filter clicked. Setting applied range:", { start, end });
        setAppliedStartDate(start);
        setAppliedEndDate(end);
        
        const dataForCalculations = rawData ? filterDataByDateRange(rawData, start, end) : { users: [], dateRange: { startDate: start, endDate: end }, monthlyHighestConsumers: {} };
        setMonthlyReportData(dataForCalculations ? calculateMonthlyReport(dataForCalculations) : []);
        setQuarterlyReportData(dataForCalculations ? calculateQuarterlyReport(dataForCalculations) : []);
    };

    const handleSort = (column) => {
        setSortOrder(prevSortOrder => {
            if (prevSortOrder.column === column) {
                if (prevSortOrder.direction === 'asc') {
                    return { column, direction: 'desc' };
                } else {
                    return { column: null, direction: null };
                }
            } else {
                return { column, direction: 'asc' };
            }
        });
    };

    const handleExportToExcel = () => {
        let csvContent = [];
        let filename = "گزارش-مصرف-اینترنت";

        let reportDisplayStartDate = appliedStartDate;
        let reportDisplayEndDate = appliedEndDate;
        if (selectedView === 'کلی' && filteredReportData) {
            reportDisplayStartDate = filteredReportData.dateRange.startDate;
            reportDisplayEndDate = filteredReportData.dateRange.endDate;
        } else if (selectedView !== 'کلی' && currentUser) {
            reportDisplayStartDate = currentUser.dailyData[0] ? currentUser.dailyData[0].day : appliedStartDate;
            reportDisplayEndDate = currentUser.dailyData[currentUser.dailyData.length - 1] ? currentUser.dailyData[currentUser.dailyData.length - 1].day : appliedEndDate;
        }


        const mainTitle = "گزارش مصرف اینترنت";
        const dateRangeText = `بازه زمانی: ${toPersianDigits(formatShamsiDate(reportDisplayStartDate))} تا ${toPersianDigits(formatShamsiDate(reportDisplayEndDate))}`;
        
        let columnCount = 0;

        if (selectedView === 'کلی') {
            const summaryHeaders = ["ردیف", "نام کامپیوتر", "نام کاربر", "آپلود (MB)", "دانلود (MB)", "مجموع مصرف (MB)"];
            columnCount = summaryHeaders.length;
            filename += "-کلی.csv";
            csvContent.push([mainTitle].concat(Array(columnCount - 1).fill('')));
            csvContent.push([dateRangeText].concat(Array(columnCount - 1).fill('')));
            csvContent.push([]);
            csvContent.push(summaryHeaders);
            sortedUsers.forEach((user, index) => {
                csvContent.push([
                    toPersianDigits(index + 1),
                    user.userId,
                    user.name,
                    toPersianDigits(user.summary.totalDownload),
                    toPersianDigits(user.summary.totalUpload),
                    toPersianDigits(user.summary.totalUsage)
                ]);
            });
            csvContent.push([
                "", // Empty cell for row number
                "", // Empty cell for computer name
                "جمع کل", // "مجموع کل"
                formatBytesToReadable(totalSummaryUsage.totalDownload),
                formatBytesToReadable(totalSummaryUsage.totalUpload),
                formatBytesToReadable(totalSummaryUsage.totalUsage)
            ]);
        } else if (selectedView === 'گزارش ماهانه') {
            // Updated headers for monthly report
            const monthlyHeaders = ["ردیف", "ماه", "تعداد روز", "آپلود (MB)", "دانلود (MB)", "مجموع مصرف (MB)", "کاربر پرمصرف", "میزان مصرف (MB/GB)"];
            columnCount = monthlyHeaders.length;
            filename += "-ماهیانه.csv";
            csvContent.push([mainTitle].concat(Array(columnCount - 1).fill('')));
            csvContent.push([dateRangeText].concat(Array(columnCount - 1).fill('')));
            csvContent.push([]);
            csvContent.push(monthlyHeaders);
            monthlyReportData.forEach((item, index) => {
                csvContent.push([
                    toPersianDigits(index + 1),
                    item.shamsiMonthName,
                    toPersianDigits(item.daysCount),
                    toPersianDigits(item.totalDownload),
                    toPersianDigits(item.totalUpload),
                    toPersianDigits(item.totalUsage),
                    item.highestConsumer,
                    formatBytesToReadable(item.highestConsumerUsage)
                ]);
            });
            csvContent.push([
                "", // Empty cell for row number
                "", // Empty cell for month
                "جمع کل", // "مجموع کل"
                formatBytesToReadable(totalMonthlyUsage.totalDownload),
                formatBytesToReadable(totalMonthlyUsage.totalUpload),
                formatBytesToReadable(totalMonthlyUsage.totalUsage),
                "", // Empty cell for highest consumer name
                ""  // Empty cell for highest consumer usage
            ]);

        } else if (selectedView === 'گزارش فصلی') {
            const quarterlyHeaders = ["ردیف", "سال", "فصل", "تعداد روز", "آپلود (MB)", "دانلود (MB)", "مجموع مصرف (MB)"];
            columnCount = quarterlyHeaders.length;
            filename += "-فصلی.csv";
            csvContent.push([mainTitle].concat(Array(columnCount - 1).fill('')));
            csvContent.push([dateRangeText].concat(Array(columnCount - 1).fill('')));
            csvContent.push([]);
            csvContent.push(quarterlyHeaders);
            quarterlyReportData.forEach((item, index) => {
                csvContent.push([
                    toPersianDigits(index + 1),
                    toPersianDigits(item.shamsiYear),
                    item.quarterName,
                    toPersianDigits(item.daysCount),
                    toPersianDigits(item.totalDownload),
                    toPersianDigits(item.totalUpload),
                    toPersianDigits(item.totalUsage)
                ]);
            });
            csvContent.push([
                "", // Empty cell for row number
                "", // Empty cell for year
                "", // Empty cell for season
                "جمع کل", // "جمع کل" now spans the correct number of cells to align
                formatBytesToReadable(totalQuarterlyUsage.totalDownload),
                formatBytesToReadable(totalQuarterlyUsage.totalUpload),
                formatBytesToReadable(totalQuarterlyUsage.totalUsage)
            ]);

        } else { // Individual user view
            const userHeaders = ["ردیف", "تاریخ", "آپلود (MB)", "دانلود (MB)", "مجموع مصرف (MB)"];
            columnCount = userHeaders.length;
            if (!currentUser) {
                setMessage({ text: 'داده‌ای برای کاربر انتخاب شده جهت خروجی اکسل یافت نشد.', type: 'warning' });
                return;
            }
            filename += `-${currentUser.name}.csv`;
            csvContent.push([mainTitle].concat(Array(columnCount - 1).fill('')));
            csvContent.push([dateRangeText].concat(Array(columnCount - 1).fill('')));
            csvContent.push([`جزئیات مصرف کاربر: ${currentUser.name} (نام کامپیوتر: ${currentUser.userId})`].concat(Array(columnCount - 1).fill('')));
            csvContent.push([]);
            csvContent.push(userHeaders);
            currentUser.dailyData.forEach((row, index) => {
                csvContent.push([
                    toPersianDigits(index + 1),
                    toPersianDigits(formatShamsiDate(row.day)),
                    toPersianDigits(row.download),
                    toPersianDigits(row.upload),
                    toPersianDigits(row.totalUsage)
                ]);
            });
            csvContent.push([
                "",
                "جمع کل",
                formatBytesToReadable(currentUser.summary.totalUpload),
                formatBytesToReadable(currentUser.summary.totalDownload),
                formatBytesToReadable(currentUser.summary.totalUsage)
            ]);
        }

        const finalCsvString = "\uFEFF" + csvContent.map(row => 
            row.map(cell => {
                let stringCell = String(cell); 
                if (stringCell.includes(';') || stringCell.includes('\n') || stringCell.includes('"')) {
                    return `"${stringCell.replace(/"/g, '""')}"`;
                }
                return stringCell;
            }).join(';')
        ).join('\r\n');

        const encoder = new TextEncoder('utf-8');
        const encoded = new TextEncoder('utf-8').encode(finalCsvString);

        const blob = new Blob([encoded], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const openDatePicker = (inputRef) => {
        if (inputRef.current) {
            if (typeof inputRef.current.showPicker === 'function') {
                inputRef.current.showPicker();
            } else {
                inputRef.current.click(); 
            }
        }
    };

    if (!rawData) {
        console.log("App: rawData is null, returning loading message."); 
        return React.createElement('div', { className: 'text-center text-lg p-4' }, 'در حال بارگذاری اطلاعات...');
    }
    
    const showMainControls = selectedView === 'کلی' || rawData.users.some(u => u.name === selectedView);

    return React.createElement('div', { className: 'max-w-7xl mx-auto report-container py-8 px-6 bg-white rounded-lg shadow-lg mt-8' },
        // Navigation Bar (always visible)
        React.createElement('nav', { className: 'navbar no-print flex justify-between items-center px-4' }, // Added items-center for vertical alignment
            // Home button - Moved to the right (first item in RTL)
            React.createElement('div', { className: 'nav-item' },
                React.createElement('button', { className: 'nav-button nav-button-home', onClick: () => { setSelectedView('کلی'); setShowMonthlyHighestChart(false); } }, 
                    React.createElement('i', { className: 'flaticon-home text-base' }) // Flaticon Home Icon, text removed, changed to text-base (1rem)
                )
            ),
            
            // Container for other menu items to align them to the left
            React.createElement('div', { className: 'flex gap-3.5' }, // Added a new div to group left-aligned items
                // Reports Dropdown
                React.createElement('div', { className: 'nav-item group' }, // Added 'group' class for Tailwind hover
                    React.createElement('button', { className: 'nav-button', onClick: (e) => e.preventDefault() }, 
                        React.createElement('i', { className: 'flaticon-file text-base ml-2' }), // Flaticon File Icon, added ml-1
                        'گزارش‌ها'
                    ), 
                    React.createElement('div', { className: 'nav-dropdown' },
                        React.createElement('a', { className: 'dropdown-item', href: '#', onClick: (e) => { e.preventDefault(); setSelectedView('گزارش ماهانه'); setShowMonthlyHighestChart(false); } }, 'گزارش ماهانه'),
                        React.createElement('a', { className: 'dropdown-item', href: '#', onClick: (e) => { e.preventDefault(); setSelectedView('گزارش فصلی'); setShowMonthlyHighestChart(false); } }, 'گزارش فصلی')
                    )
                ),

                // Print and Save Dropdown
                React.createElement('div', { className: 'nav-item group' }, // Added 'group' class for Tailwind hover
                    React.createElement('button', { className: 'nav-button', onClick: (e) => e.preventDefault() }, 
                        React.createElement('i', { className: 'flaticon-exit text-base ml-2' }), // Flaticon Exit Icon (for print/save), added ml-1
                        'چاپ و ذخیره'
                    ), 
                    React.createElement('div', { className: 'nav-dropdown' },
                        React.createElement('a', { className: 'dropdown-item', href: '#', onClick: (e) => { e.preventDefault(); handleExportToExcel(); } }, 'ذخیره اکسل'),
                        React.createElement('a', { className: 'dropdown-item', href: '#', onClick: (e) => { e.preventDefault(); window.print(); } }, 'چاپ / ذخیره PDF')
                    )
                )
            )
        ),

        React.createElement('div', { className: 'print-section' },
            React.createElement('h1', { className: 'text-3xl font-bold mb-4 text-center text-gray-800' }, 'گزارش مصرف اینترنت'),
            React.createElement('p', { className: 'text-center mb-6 text-gray-600' }, 
                'بازه زمانی: ' + toPersianDigits(formatShamsiDate(data ? data.dateRange.startDate : '')) + 
                ' تا ' + toPersianDigits(formatShamsiDate(data ? data.dateRange.endDate : ''))
            )
        ),
        // Render controls container only if showMainControls is true
        showMainControls && React.createElement('div', { className: 'controls-container no-print' },
            React.createElement('div', { className: 'control-group' },
                React.createElement('label', { htmlFor: 'user-select' }, 'انتخاب گزارش:'),
                React.createElement('select', { id: 'user-select', value: selectedView, onChange: e => setSelectedView(e.target.value) },
                    React.createElement('option', { value: 'کلی' }, 'گزارش کلی'),
                    ...(data && data.users && data.users.length > 0 ? data.users.map(user => React.createElement('option', { key: user.name, value: user.name }, user.name)) : [])
                )
            ),
            React.createElement('div', { className: 'control-group' },
                React.createElement('label', { htmlFor: 'predefined-range-select' }, 'بازه زمانی:'),
                React.createElement('select', { id: 'predefined-range-select', value: predefinedRange, onChange: handlePredefinedRangeChange },
                    React.createElement('option', { value: 'week' }, 'هفته اخیر'),
                    React.createElement('option', { value: 'month' }, 'ماه جاری'),
                    React.createElement('option', { value: '3months' }, '۳ ماه اخیر'),
                    React.createElement('option', { value: '6months' }, '۶ ماه اخیر')
                )
            ),
            React.createElement('div', { className: 'control-group' },
                React.createElement('label', { htmlFor: 'start-date-display' }, 'از تاریخ:'), 
                React.createElement('button', {
                    className: 'date-picker-button',
                    onClick: () => openDatePicker(startDateInputRef)
                },
                    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24' },
                        React.createElement('path', { d: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z' })
                    ),
                    React.createElement('span', { id: 'start-date-display' }, toPersianDigits(formatShamsiDate(displayStartDate)))
                ),
                React.createElement('input', { 
                    type: 'date', 
                    id: 'start-date', 
                    value: displayStartDate, 
                    onChange: e => setDisplayStartDate(e.target.value),
                    min: rawData ? rawData.dateRange.startDate : '', // Use rawData if available
                    max: rawData ? rawData.dateRange.endDate : '', // Use rawData if available
                    ref: startDateInputRef, 
                    className: 'hidden-date-input' 
                })
            ),
            React.createElement('div', { className: 'control-group' },
                React.createElement('label', { htmlFor: 'end-date-display' }, 'تا تاریخ:'), 
                React.createElement('button', {
                    className: 'date-picker-button',
                    onClick: () => openDatePicker(endDateInputRef)
                },
                    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24' },
                        React.createElement('path', { d: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z' })
                    ),
                    React.createElement('span', { id: 'end-date-display' }, toPersianDigits(formatShamsiDate(displayEndDate)))
                ),
                React.createElement('input', { 
                    type: 'date', 
                    id: 'end-date', 
                    value: displayEndDate, 
                    onChange: e => setDisplayEndDate(e.target.value),
                    min: rawData ? rawData.dateRange.startDate : '', // Use rawData if available
                    max: rawData ? rawData.dateRange.endDate : '', // Use rawData if available
                    ref: endDateInputRef, 
                    className: 'hidden-date-input' 
                })
            ),
            React.createElement('button', {
                onClick: handleApplyFilter,
                className: 'bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-md shadow-md transition-all duration-300 ease-in-out'
            }, 'اعمال فیلتر')
        ),
        // Conditional rendering based on selectedView
        selectedView === 'کلی' ? React.createElement('div', { key: 'summary-view' },
            React.createElement('div', { className: 'print-section' },
                React.createElement('h2', { className: 'text-xl font-semibold mb-4 text-gray-700' }, 'خلاصه کل مصرف'),
                React.createElement('table', { className: 'w-full' },
                    React.createElement('thead', null, React.createElement('tr', null, 
                        React.createElement('th', null, 'ردیف'),
                        React.createElement('th', null, 'نام کامپیوتر'),
                        React.createElement('th', null, 'نام کاربر'),
                        React.createElement('th', null, 'آپلود (MB)'),
                        React.createElement('th', null, 'دانلود (MB)'),
                        React.createElement('th', { 
                            onClick: () => handleSort('totalUsage'), 
                            className: 'cursor-pointer hover:bg-gray-300 transition-colors duration-200' 
                        },
                            React.createElement('div', { className: 'flex items-center justify-center' },
                                'مجموع مصرف (MB)',
                                React.createElement('div', { className: 'flex flex-col ml-1 -space-y-1.5 justify-center' },
                                    React.createElement('svg', { 
                                        className: `w-4 h-4 ${sortOrder.column === 'totalUsage' && sortOrder.direction === 'asc' ? 'text-black' : 'text-gray-400'}`, 
                                        viewBox: '0 0 24 24', 
                                        fill: 'currentColor' 
                                    },
                                        React.createElement('path', { d: 'M7 14l5-5 5 5z' })
                                    ),
                                    React.createElement('svg', { 
                                        className: `w-4 h-4 ${sortOrder.column === 'totalUsage' && sortOrder.direction === 'desc' ? 'text-black' : 'text-gray-400'}`, 
                                        viewBox: '0 0 24 24', 
                                        fill: 'currentColor' 
                                    },
                                        React.createElement('path', { d: 'M7 10l5 5 5-5z' })
                                    )
                                )
                            )
                        )
                    )),
                    React.createElement('tbody', null, 
                        sortedUsers && sortedUsers.length > 0 ? 
                            sortedUsers.map((user, index) => React.createElement('tr', { 
                                key: user.userId, 
                                className: user.summary.totalUsage === maxTotalUsageSummary ? 'bg-red-100' : '' 
                            },
                                React.createElement('td', null, toPersianDigits(index + 1)),
                                React.createElement('td', null, user.userId),
                                React.createElement('td', null, user.name),
                                React.createElement('td', null, toPersianDigits(user.summary.totalDownload)), // Keep as MB
                                React.createElement('td', null, toPersianDigits(user.summary.totalUpload)),   // Keep as MB
                                React.createElement('td', null, toPersianDigits(user.summary.totalUsage))    // Keep as MB
                            )) 
                        : null,
                        // Total row for summary table
                        React.createElement('tr', { className: 'font-bold bg-gray-200' }, 
                            React.createElement('td', { colSpan: 3 }, 'جمع کل'),
                            React.createElement('td', null, formatBytesToReadable(totalSummaryUsage.totalDownload)),
                            React.createElement('td', null, formatBytesToReadable(totalSummaryUsage.totalUpload)),
                            React.createElement('td', null, formatBytesToReadable(totalSummaryUsage.totalUsage))
                        )
                    )
                )
            ),
            React.createElement('canvas', { id: 'summaryChart', className: 'print-section mt-8' })
        ) : selectedView === 'گزارش ماهانه' ? React.createElement('div', { key: 'monthly-view' },
            React.createElement('div', { className: 'monthly-report-header' }, // Flex container for title and button
                React.createElement('h2', { className: 'text-xl font-semibold text-gray-700' }, 'گزارش کلی ماهیانه'),
                React.createElement('button', {
                    onClick: () => setShowMonthlyHighestChart(prev => !prev),
                    className: 'monthly-chart-toggle-button' // Custom class for styling
                }, showMonthlyHighestChart ? 'نمایش چارت مجموع مصرف ماهیانه' : 'نمایش چارت کاربران پرمصرف')
            ),
            React.createElement('div', { className: 'print-section' },
                React.createElement('table', { className: 'w-full' },
                    React.createElement('thead', null, React.createElement('tr', null,
                        React.createElement('th', null, 'ردیف'),
                        React.createElement('th', null, 'ماه'),
                        React.createElement('th', null, 'تعداد روز'),
                        React.createElement('th', null, 'آپلود (MB)'),
                        React.createElement('th', null, 'دانلود (MB)'),
                        // Corrected: Moved border-l class to "مجموع مصرف (MB)" th, and set color to gray-200
                        React.createElement('th', { className: 'border-l-4 border-l-gray-200', colSpan: 1 }, 'مجموع مصرف (MB)'), 
                        React.createElement('th', null, 'کاربر پرمصرف'), 
                        React.createElement('th', null, 'میزان مصرف (MB/GB)')
                    )),
                    React.createElement('tbody', null,
                        monthlyReportData && monthlyReportData.length > 0 ?
                            monthlyReportData.map((item, index) => React.createElement('tr', { key: item.monthKey },
                                React.createElement('td', null, toPersianDigits(index + 1)),
                                React.createElement('td', null, item.shamsiMonthName),
                                React.createElement('td', null, toPersianDigits(item.daysCount)),
                                React.createElement('td', null, toPersianDigits(item.totalDownload)), // Keep as MB
                                React.createElement('td', null, toPersianDigits(item.totalUpload)),   // Keep as MB
                                // Corrected: Moved border-l class to "مجموع مصرف (MB)" td
                                React.createElement('td', { className: 'border-l-4 border-l-gray-200', colSpan: 1 }, toPersianDigits(item.totalUsage)),    // Keep as MB
                                React.createElement('td', null, item.highestConsumer), 
                                React.createElement('td', null, formatBytesToReadable(item.highestConsumerUsage))
                            ))
                            : React.createElement('tr', null, React.createElement('td', { colSpan: 8 }, 'داده‌ای برای گزارش ماهانه پیدا نشد.')), // Colspan adjusted
                        // Total row for monthly report
                        React.createElement('tr', { className: 'font-bold bg-gray-200' }, 
                            React.createElement('td', { colSpan: 3 }, 'جمع کل'), 
                            React.createElement('td', null, formatBytesToReadable(totalMonthlyUsage.totalDownload)), 
                            React.createElement('td', null, formatBytesToReadable(totalMonthlyUsage.totalUpload)), 
                            
                            // Apply bg-gray-200 here to preserve background, and apply border-l-4 border-l-gray-200 for the border
                            React.createElement('td', { className: 'bg-gray-200 border-l-4 border-l-gray-200', colSpan: 1 }, formatBytesToReadable(totalMonthlyUsage.totalUsage)),
                            
                            // Apply summary-transparent-cell for last two columns
                            React.createElement('td', { className: 'summary-transparent-cell' }, ''), 
                            React.createElement('td', { className: 'summary-transparent-cell' }, '')  
                        )
                    )
                )
            ),
            React.createElement('canvas', { id: 'monthlyChart', className: 'print-section mt-8' })
        ) : selectedView === 'گزارش فصلی' ? React.createElement('div', { key: 'quarterly-view' },
            React.createElement('div', { className: 'print-section' },
                React.createElement('h2', { className: 'text-xl font-semibold mb-4 text-gray-700' }, 'گزارش کلی فصلی'),
                React.createElement('table', { className: 'w-full' },
                    React.createElement('thead', null, React.createElement('tr', null,
                        React.createElement('th', null, 'ردیف'),
                        React.createElement('th', null, 'سال شمسی'),
                        React.createElement('th', null, 'فصل'),
                        React.createElement('th', null, 'تعداد روز'),
                        React.createElement('th', null, 'آپلود (MB)'),
                        React.createElement('th', null, 'دانلود (MB)'),
                        React.createElement('th', null, 'مجموع مصرف (MB)')
                    )),
                    React.createElement('tbody', null,
                        quarterlyReportData && quarterlyReportData.length > 0 ?
                            quarterlyReportData.map((item, index) => React.createElement('tr', { key: item.quarterKey },
                                React.createElement('td', null, toPersianDigits(index + 1)),
                                React.createElement('td', null, toPersianDigits(item.shamsiYear)),
                                React.createElement('td', null, item.quarterName),
                                React.createElement('td', null, toPersianDigits(item.daysCount)),
                                React.createElement('td', null, toPersianDigits(item.totalDownload)),
                                React.createElement('td', null, toPersianDigits(item.totalUpload)),
                                React.createElement('td', null, toPersianDigits(item.totalUsage))
                            ))
                            : React.createElement('tr', null, React.createElement('td', { colSpan: 7 }, 'داده‌ای برای گزارش فصلی پیدا نشد.')),
                        // Total row for quarterly report
                        React.createElement('tr', { className: 'font-bold bg-gray-200' }, 
                            React.createElement('td', { colSpan: 4 }, 'جمع کل'),
                            React.createElement('td', null, formatBytesToReadable(totalQuarterlyUsage.totalDownload)),
                            React.createElement('td', null, formatBytesToReadable(totalQuarterlyUsage.totalUpload)),
                            React.createElement('td', null, formatBytesToReadable(totalQuarterlyUsage.totalUsage))
                        )
                    )
                )
            ),
            React.createElement('canvas', { id: 'quarterlyChart', className: 'print-section mt-8' })
        ) : (currentUser && currentUser.dailyData.length > 0 ? React.createElement('div', { key: 'user-view' }, 
            React.createElement('div', { className: 'print-section' },
                React.createElement('h2', { className: 'text-xl font-semibold mb-4 text-gray-700' }, 'جزئیات مصرف کاربر: ' + selectedView),
                React.createElement('table', { className: 'w-full' },
                    React.createElement('thead', null, React.createElement('tr', null, 
                        React.createElement('th', null, 'ردیف'),
                        React.createElement('th', null, 'تاریخ'),
                        React.createElement('th', null, 'آپلود (MB)'),
                        React.createElement('th', null, 'دانلود (MB)'),
                        React.createElement('th', null, 'مجموع مصرف (MB)')
                    )),
                    React.createElement('tbody', null,
                        ...currentUser.dailyData.map((row, i) => React.createElement('tr', { 
                            key: i, 
                            className: row.totalUsage === maxTotalDailyUsage ? 'bg-red-100' : '' 
                        },
                            React.createElement('td', null, toPersianDigits(i + 1)),
                            React.createElement('td', null, toPersianDigits(formatShamsiDate(row.day))),
                            React.createElement('td', null, toPersianDigits(row.download)),
                            React.createElement('td', null, toPersianDigits(row.upload)),
                            React.createElement('td', null, toPersianDigits(row.totalUsage))
                        )),
                        React.createElement('tr', { className: 'font-bold bg-gray-200' },
                            React.createElement('td', null, ''),
                            React.createElement('td', null, 'جمع کل'),
                            React.createElement('td', null, formatBytesToReadable(currentUser.summary.totalUpload)),
                            React.createElement('td', null, formatBytesToReadable(currentUser.summary.totalDownload)),
                            React.createElement('td', null, formatBytesToReadable(currentUser.summary.totalUsage))
                        )
                    )
                )
            ),
            React.createElement('canvas', { id: 'userChart', className: 'print-section mt-8' })
        ) : null) 
    );
}

// Top-level rendering with global message state
const RootComponent = () => {
    const [message, setMessage] = useState(null); 

    useEffect(() => {
        console.log("RootComponent: Message useEffect triggered. Current message:", message);
        if (message) {
            const timer = setTimeout(() => {
                console.log("RootComponent: Auto-hide timer finished. Setting message to null.");
                setMessage(null);
            }, 2500);
            return () => {
                console.log("RootComponent: Cleared previous auto-close timer.");
                clearTimeout(timer);
            };
        } else {
            console.log("RootComponent: Message is null. No timer to set or clear.");
        }
    }, [message]);

    return React.createElement(
        'div',
        null,
        React.createElement(App, { setMessage: setMessage, message: message }), 
        React.createElement(MessageBox, { message: message, onClose: () => {
            console.log("RootComponent: Manual close clicked. Setting message to null.");
            setMessage(null);
        } })
    );
};

ReactDOM.render(React.createElement(RootComponent), document.getElementById('root'));
