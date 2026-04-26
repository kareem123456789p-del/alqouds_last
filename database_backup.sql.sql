-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3307
-- Generation Time: Apr 22, 2026 at 11:03 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `alquods_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `client_transactions`
--

CREATE TABLE `client_transactions` (
  `id` int(11) NOT NULL,
  `client_id` int(11) DEFAULT NULL,
  `pharmacy_id` int(11) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `reference_id` int(11) DEFAULT NULL,
  `date` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `client_transactions`
--

INSERT INTO `client_transactions` (`id`, `client_id`, `pharmacy_id`, `type`, `amount`, `reference_id`, `date`) VALUES
(1, NULL, NULL, 'ORDER', 55.00, 1, '2026-04-11 16:57:06'),
(2, NULL, NULL, 'ORDER', 110.00, 2, '2026-04-11 17:22:11'),
(3, NULL, NULL, 'ORDER', 220.00, 3, '2026-04-11 17:51:27'),
(4, 6, NULL, 'ORDER', 1798.00, 4, '2026-04-12 13:07:50'),
(5, NULL, 7, 'ORDER', 63.80, 6, '2026-04-12 16:01:33'),
(6, 6, NULL, 'ORDER', 423.50, 5, '2026-04-12 16:01:36'),
(7, 6, NULL, 'PAYMENT', -500.00, 1, '2026-04-12 16:15:06'),
(8, 6, NULL, 'PAYMENT', -500.00, 2, '2026-04-12 16:15:14'),
(9, 6, NULL, 'PAYMENT', -221.00, 3, '2026-04-12 16:15:30');

-- --------------------------------------------------------

--
-- Table structure for table `doctors`
--

CREATE TABLE `doctors` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `specialty` varchar(100) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `license_number` varchar(100) DEFAULT NULL,
  `status` enum('active','away') DEFAULT 'active',
  `location` varchar(255) DEFAULT NULL,
  `credit_limit` decimal(10,2) DEFAULT 60000.00,
  `total_debt` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `doctors`
--

INSERT INTO `doctors` (`id`, `name`, `specialty`, `phone`, `email`, `license_number`, `status`, `location`, `credit_limit`, `total_debt`, `created_at`) VALUES
(4, 'احمد سيليمان', 'جراحة عامة', '01002416690', NULL, NULL, 'active', 'طريق السادات ', 60000.00, 0.00, '2026-04-12 09:40:11'),
(5, 'ناديه النجار', 'قلب وأوعية', '0000', NULL, NULL, 'active', 'الكورنيش ', 60000.00, 0.00, '2026-04-12 09:41:11'),
(6, 'مركز الخليل', 'جراحة عامة', '0000', NULL, NULL, 'active', 'الاشاره ', 60000.00, 1000.50, '2026-04-12 09:42:06');

-- --------------------------------------------------------

--
-- Table structure for table `employee_withdrawals`
--

CREATE TABLE `employee_withdrawals` (
  `id` int(11) NOT NULL,
  `staff_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `category` varchar(50) DEFAULT 'Personal',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `employee_withdrawals`
--

INSERT INTO `employee_withdrawals` (`id`, `staff_id`, `amount`, `reason`, `category`, `created_at`) VALUES
(1, 1, 5000.00, 'Personal', 'Personal', '2026-04-11 16:57:51');

-- --------------------------------------------------------

--
-- Table structure for table `import_logs`
--

CREATE TABLE `import_logs` (
  `id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `returned_qty` int(11) DEFAULT 0,
  `return_reason` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `invoice_image` varchar(500) DEFAULT NULL,
  `shipment_id` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `import_logs`
--

INSERT INTO `import_logs` (`id`, `product_id`, `warehouse_id`, `supplier_id`, `quantity`, `unit_price`, `returned_qty`, `return_reason`, `status`, `created_at`, `invoice_image`, `shipment_id`) VALUES
(1, 8, 6, NULL, 50, 50.00, 0, NULL, 'Active', '2026-04-11 16:23:52', NULL, NULL),
(2, 8, 6, NULL, 10, 50.00, 0, NULL, 'Active', '2026-04-11 17:20:27', NULL, NULL),
(3, 22, 6, 8, 8, 310.00, 0, NULL, 'Active', '2026-04-12 13:03:31', NULL, NULL),
(4, 47, 6, 8, 12, 385.00, 0, NULL, 'Active', '2026-04-12 13:03:31', NULL, NULL),
(5, 48, 6, 8, 36, 58.00, 0, NULL, 'Active', '2026-04-12 13:03:31', NULL, NULL),
(6, 22, 6, 8, 1, 310.00, 0, NULL, 'Active', '2026-04-12 13:16:55', NULL, NULL),
(7, 47, 6, 8, 1, 385.00, 0, NULL, 'Active', '2026-04-13 11:29:10', NULL, NULL),
(8, 17, 6, 9, 10, 50.00, 0, NULL, 'Active', '2026-04-13 12:07:37', NULL, NULL),
(9, 12, 7, 10, 10, 200.00, 0, NULL, 'Active', '2026-04-13 16:08:06', NULL, NULL),
(10, 28, 7, 10, 50, 10.00, 0, NULL, 'Active', '2026-04-13 16:08:06', NULL, NULL),
(11, 16, 6, 10, 10, 500.00, 0, NULL, 'Active', '2026-04-14 21:48:09', NULL, NULL),
(12, 13, 7, 10, 2, 200.00, 0, NULL, 'Active', '2026-04-22 15:16:04', NULL, NULL),
(13, 14, 7, 10, 2, 20.00, 0, NULL, 'Active', '2026-04-22 15:18:22', NULL, NULL),
(14, 15, 7, 10, 2, 20.00, 0, NULL, 'Active', '2026-04-22 15:41:46', NULL, 'SHP-1776872506269-TSNUE'),
(15, 15, 7, 10, 2, 20.00, 0, NULL, 'Active', '2026-04-22 16:03:04', '/uploads/invoices/invoice_1776873784259_pvo18.jpeg', 'SHP-1776873784266-4A54J'),
(16, 33, 7, 10, 1, 400.00, 0, NULL, 'Active', '2026-04-22 16:16:44', NULL, 'SHP-1776874604181-XH0U6'),
(17, 33, 7, 10, 2, 500.00, 0, NULL, 'Active', '2026-04-22 16:17:22', NULL, 'SHP-1776874642435-55WVV'),
(18, 33, 7, 10, 1, 599.98, 0, NULL, 'Active', '2026-04-22 16:38:11', NULL, 'SHP-1776875891100-4S185'),
(19, 33, 7, 10, 1, 900.00, 0, NULL, 'Active', '2026-04-22 17:35:39', NULL, 'SHP-1776879339283-ITZDG'),
(20, 33, 7, 10, 1, 900.00, 0, NULL, 'Active', '2026-04-22 17:36:28', NULL, 'SHP-1776879387964-330VL'),
(21, 23, 7, 10, 2, 20.00, 0, NULL, 'Active', '2026-04-22 17:37:24', NULL, 'SHP-1776879444813-49CK2'),
(22, 29, 7, 10, 1, 40.00, 0, NULL, 'Active', '2026-04-22 17:38:05', NULL, 'SHP-1776879485785-U2VYG'),
(23, 33, 7, 10, 1, 900.00, 0, NULL, 'Active', '2026-04-22 17:49:51', NULL, 'SHP-1776880191835-9MGUU'),
(24, 33, 7, 8, 1, 900.00, 0, NULL, 'Active', '2026-04-22 18:04:06', '/uploads/invoices/invoice_1776881046558_n7enb.jpeg', 'SHP-1776881046562-LQKVT');

-- --------------------------------------------------------

--
-- Table structure for table `local_suppliers`
--

CREATE TABLE `local_suppliers` (
  `id` int(11) NOT NULL,
  `supplier_code` varchar(20) DEFAULT NULL,
  `company_name` varchar(150) NOT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `city_area` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `local_suppliers`
--

INSERT INTO `local_suppliers` (`id`, `supplier_code`, `company_name`, `contact_person`, `phone`, `city_area`, `notes`, `created_at`, `updated_at`) VALUES
(4, 'LOC-0201', 'شركه الفرقان', 'علاء بغدادي', '0225317018', 'القصر العيني', NULL, '2026-04-12 09:27:35', '2026-04-12 09:27:35'),
(5, 'LOC-0202', 'شركه مكه', 'محسن ركابي', '01118331782', 'ادفو', NULL, '2026-04-12 09:28:10', '2026-04-12 09:28:10'),
(6, 'LOC-0203', 'شركه هورس', 'محمد', '01120952420', 'القاهره', NULL, '2026-04-12 09:29:18', '2026-04-12 09:29:18'),
(7, 'LOC-0204', 'شركه سيتي فارما', 'محمد علي', '01007184037', 'سوهاج', NULL, '2026-04-12 09:30:01', '2026-04-12 09:30:01'),
(8, 'LOC-0205', 'شركه الصفا', 'خالد', '01123038644', 'ادفو', NULL, '2026-04-12 09:31:46', '2026-04-12 09:31:46'),
(9, 'LOC-0206', 'شركه البرج', 'خالد', '01141771914', 'سوهاج', NULL, '2026-04-12 09:34:04', '2026-04-12 09:34:04'),
(10, 'LOC-0207', 'وهمي', 'وهمي', '0000', '0000', NULL, '2026-04-13 16:06:31', '2026-04-13 16:06:31');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `order_number` varchar(50) DEFAULT NULL,
  `client_id` int(11) DEFAULT NULL,
  `pharmacy_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `staff_id` int(11) DEFAULT NULL,
  `expected_delivery` date DEFAULT NULL,
  `total_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` varchar(50) NOT NULL DEFAULT 'Pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `order_number`, `client_id`, `pharmacy_id`, `warehouse_id`, `staff_id`, `expected_delivery`, `total_amount`, `status`, `created_at`) VALUES
(1, '#ORD-2026-1001', NULL, NULL, 6, NULL, '2026-04-11', 55.00, 'Dispatched', '2026-04-11 16:56:45'),
(2, '#ORD-2026-1002', NULL, NULL, 6, NULL, '2026-04-11', 110.00, 'Dispatched', '2026-04-11 17:21:50'),
(3, '#ORD-2026-1003', NULL, NULL, 7, NULL, '2026-04-11', 220.00, 'Dispatched', '2026-04-11 17:51:12'),
(4, '#ORD-2026-1004', 6, NULL, 6, NULL, '2026-04-12', 1798.00, 'Dispatched', '2026-04-12 13:07:43'),
(5, '#ORD-2026-1005', 6, NULL, 7, NULL, '2026-04-12', 423.50, 'Dispatched', '2026-04-12 15:57:18'),
(6, '#ORD-2026-1006', NULL, 7, 7, NULL, '2026-04-12', 63.80, 'Dispatched', '2026-04-12 15:58:06');

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `inventory_id` int(11) DEFAULT NULL,
  `batch_no` varchar(100) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `qty` int(11) NOT NULL DEFAULT 0,
  `returned_qty` int(11) DEFAULT 0,
  `return_reason` varchar(255) DEFAULT NULL,
  `base_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `profit_margin` decimal(5,2) DEFAULT 0.00,
  `discount` decimal(10,2) DEFAULT 0.00,
  `tax` decimal(10,2) DEFAULT 0.00,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `warehouse_id`, `inventory_id`, `batch_no`, `expiry_date`, `qty`, `returned_qty`, `return_reason`, `base_price`, `unit_price`, `profit_margin`, `discount`, `tax`, `subtotal`) VALUES
(1, 1, 8, 6, NULL, NULL, NULL, 1, 0, NULL, 50.00, 55.00, 0.10, 0.00, 0.00, 55.00),
(2, 2, 8, 6, 15, NULL, NULL, 1, 0, NULL, 50.00, 55.00, 0.10, 0.00, 0.00, 55.00),
(3, 2, 8, 6, 8, NULL, NULL, 1, 0, NULL, 50.00, 55.00, 0.10, 0.00, 0.00, 55.00),
(4, 3, 8, 7, NULL, NULL, NULL, 1, 0, NULL, 50.00, 55.00, 0.10, 0.00, 0.00, 55.00),
(5, 3, 8, 6, 15, NULL, NULL, 3, 0, NULL, 50.00, 55.00, 0.10, 0.00, 0.00, 165.00),
(6, 4, 22, 6, NULL, NULL, NULL, 4, 0, NULL, 310.00, 449.50, 0.45, 0.00, 0.00, 1798.00),
(7, 5, 47, 7, NULL, NULL, NULL, 1, 0, NULL, 385.00, 423.50, 0.10, 0.00, 0.00, 423.50),
(8, 6, 48, 7, NULL, NULL, NULL, 1, 0, NULL, 58.00, 63.80, 0.10, 0.00, 0.00, 63.80);

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `client_id` int(11) DEFAULT NULL COMMENT 'References doctors(id)',
  `pharmacy_id` int(11) DEFAULT NULL COMMENT 'References pharmacies(id)',
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payment_method` varchar(50) DEFAULT 'Cash',
  `reference_no` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`id`, `client_id`, `pharmacy_id`, `amount`, `payment_method`, `reference_no`, `notes`, `created_at`) VALUES
(1, 6, NULL, 500.00, 'كاش', NULL, NULL, '2026-04-12 16:15:06'),
(2, 6, NULL, 500.00, 'كاش', NULL, NULL, '2026-04-12 16:15:14'),
(3, 6, NULL, 221.00, 'كاش', NULL, NULL, '2026-04-12 16:15:30');

-- --------------------------------------------------------

--
-- Table structure for table `pharmacies`
--

CREATE TABLE `pharmacies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `license_number` varchar(100) DEFAULT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `area` varchar(100) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `status` enum('active','pending','suspended') DEFAULT 'active',
  `credit_limit` decimal(12,2) DEFAULT 20000.00,
  `total_debt` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pharmacies`
--

INSERT INTO `pharmacies` (`id`, `name`, `license_number`, `contact_person`, `area`, `phone`, `email`, `status`, `credit_limit`, `total_debt`, `created_at`) VALUES
(3, 'عبدالملاك صبحي', NULL, 'دكتور ملاك', 'حكروب', '01228474365', NULL, 'active', 25000.00, 0.00, '2026-04-12 09:49:09'),
(4, 'مصطفي سيد', NULL, 'دكتور مصطفي', 'السيل', '01092136684', NULL, 'active', 20000.00, 0.00, '2026-04-12 09:50:00'),
(5, 'صابر الطويل', NULL, 'دكتور صابر', 'الصداقه القديمه', '01153140953', NULL, 'active', 150000.00, 0.00, '2026-04-12 09:51:18'),
(6, 'مني الجديده', NULL, 'دكتوره مني', 'السيل الريفي', '01100914212', NULL, 'active', 10000.00, 0.00, '2026-04-12 09:54:13'),
(7, ' السلام', NULL, '... ', 'شارع المطار', '0000', NULL, 'active', 30000.00, 63.80, '2026-04-12 09:55:21'),
(8, 'النجاح الكبري', NULL, '....', 'خور عواضه', '0000', NULL, 'active', 20000.00, 0.00, '2026-04-12 09:56:21'),
(9, 'تعاون كيما', NULL, 'دكتور احمد الوسيم', 'كيما', '01117884457', NULL, 'active', 50000.00, 0.00, '2026-04-12 09:58:16'),
(10, 'برج الاطباء', NULL, 'دكتور ابراهيم', 'البلدوزر', '0106423302', NULL, 'active', 100000.00, 0.00, '2026-04-12 09:59:15');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `sku` varchar(50) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `manufacturer` varchar(100) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `purchase_price` decimal(10,2) DEFAULT 0.00,
  `expiry_date` date DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `base_uom_id` int(11) DEFAULT NULL,
  `bulk_uom_id` int(11) DEFAULT NULL,
  `conversion_factor` decimal(10,4) DEFAULT 1.0000,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 = active/visible, 0 = soft-deleted',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `name`, `sku`, `category`, `manufacturer`, `quantity`, `price`, `purchase_price`, `expiry_date`, `image_url`, `base_uom_id`, `bulk_uom_id`, `conversion_factor`, `is_deleted`, `is_active`, `created_at`) VALUES
(1, 'Amoxicillin 500mg', 'AMX-500', 'Antibiotic', 'EgyptPharma', 480, 12.50, 8.00, NULL, NULL, 1, 2, 24.0000, 1, 0, '2026-04-11 13:55:33'),
(2, 'Paracetamol 500mg', 'PCM-500', 'Analgesic', 'CairoChem', 1200, 5.00, 2.50, NULL, NULL, 1, 6, 10.0000, 1, 0, '2026-04-11 13:55:33'),
(3, 'Omeprazole 20mg', 'OMP-020', 'Gastric', 'MediBridge', 336, 18.00, 11.00, NULL, NULL, 1, 2, 28.0000, 1, 0, '2026-04-11 13:55:33'),
(4, 'Metformin 850mg', 'MET-850', 'Diabetes', 'NilePharma', 600, 22.00, 14.50, NULL, NULL, 1, 2, 30.0000, 1, 0, '2026-04-11 13:55:33'),
(5, 'Atorvastatin 40mg', 'ATV-040', 'Cardiovascular', 'HealthLine EG', 280, 35.00, 23.00, NULL, NULL, 1, 2, 28.0000, 1, 0, '2026-04-11 13:55:33'),
(6, 'Azithromycin 500mg', 'AZI-500', 'Antibiotic', 'EgyptPharma', 72, 45.00, 30.00, NULL, NULL, 1, 6, 6.0000, 1, 0, '2026-04-11 13:55:33'),
(7, 'Cetirizine 10mg', 'CTZ-010', 'Antihistamine', 'CairoChem', 500, 8.00, 4.00, NULL, NULL, 1, 6, 10.0000, 1, 0, '2026-04-11 13:55:33'),
(8, 'panadol', NULL, NULL, NULL, 58, 50.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-11 16:08:26'),
(10, 'panadol', NULL, NULL, NULL, 0, 0.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:13:52'),
(11, 'mmmdl', NULL, NULL, NULL, 0, 0.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:14:03'),
(12, 'جهاز ضغط', NULL, NULL, NULL, 9, 0.00, 200.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:14:20'),
(13, 'جهاز سكر رابتو تست', NULL, NULL, NULL, 2, 0.00, 200.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:14:49'),
(14, 'انكل زولا', NULL, NULL, NULL, 2, 0.00, 20.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:15:09'),
(15, 'كحول', NULL, NULL, NULL, 4, 0.00, 20.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:15:16'),
(16, 'سماعات هاي كير', NULL, NULL, NULL, 10, 0.00, 500.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:15:37'),
(17, 'محلول ملح', NULL, NULL, NULL, 9, 0.00, 50.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:17:17'),
(18, 'سرنجات 3', NULL, NULL, NULL, 0, 10.50, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:17:31'),
(19, 'سرنجات 10', NULL, NULL, NULL, 0, 25.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:17:46'),
(20, 'سرنجات 5', NULL, NULL, NULL, 0, 15.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:17:55'),
(21, 'مفارش سرير 60*90', NULL, NULL, NULL, 0, 0.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:18:16'),
(22, 'مفارش سرير 90*180', NULL, NULL, NULL, 5, 310.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:18:32'),
(23, 'بيتادين جراحه', NULL, NULL, NULL, 2, 120.00, 20.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:18:44'),
(24, 'قطن 25ج', NULL, NULL, NULL, 0, 45.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:18:53'),
(25, 'كرسي ستنادر', NULL, NULL, NULL, 0, 1500.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:19:31'),
(26, 'جل سونار', NULL, NULL, NULL, 0, 65.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:19:57'),
(27, 'قسطره سيليكون', NULL, NULL, NULL, 0, 85.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:20:18'),
(28, 'جهاز محول', NULL, NULL, NULL, 49, 0.00, 10.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 09:20:25'),
(29, 'حفاظات كبار سن', NULL, NULL, NULL, 0, 320.00, 40.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:20:36'),
(30, 'جهاز نقل دم', NULL, NULL, NULL, 0, 180.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:20:46'),
(31, 'جمع بول', NULL, NULL, NULL, 0, 35.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:20:58'),
(32, 'شاش 15س', NULL, NULL, NULL, 0, 22.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:21:17'),
(33, 'جهاز نبولايزر', NULL, NULL, NULL, 6, 900.00, 900.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:21:30'),
(34, 'بلاستر 10 س', NULL, NULL, NULL, 0, 18.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:21:37'),
(35, 'قلتر غسيل fx80', NULL, NULL, NULL, 0, 210.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:21:53'),
(36, 'كبسوله غسيل 5008', NULL, NULL, NULL, 0, 340.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:22:11'),
(37, 'جركن سترو', NULL, NULL, NULL, 0, 110.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:22:22'),
(38, 'جركن غسيل 20 ل', NULL, NULL, NULL, 0, 190.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:22:32'),
(39, 'لاين غسيل 5008', NULL, NULL, NULL, 0, 85.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:22:44'),
(40, 'ابره فستولا', NULL, NULL, NULL, 0, 45.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:22:54'),
(41, 'لاين gms', NULL, NULL, NULL, 0, 75.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:23:11'),
(42, 'ارضي دياثرمي', NULL, NULL, NULL, 0, 55.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:23:43'),
(43, 'وصله شفاط جراحي', NULL, NULL, NULL, 0, 130.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:23:55'),
(44, 'سيرجيفكس', NULL, NULL, NULL, 0, 60.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:24:04'),
(45, 'تيمب كول', NULL, NULL, NULL, 0, 25.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:24:21'),
(46, 'عازل طبي بالموز', NULL, NULL, NULL, 0, 15.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 0, 1, '2026-04-12 09:24:41'),
(47, 'لزقه النمر', NULL, NULL, NULL, 2, 385.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 12:53:53'),
(48, 'سبايرو تدريب نفس', NULL, NULL, NULL, 36, 58.00, 0.00, NULL, NULL, 8, NULL, 1.0000, 1, 0, '2026-04-12 12:54:46');

-- --------------------------------------------------------

--
-- Table structure for table `retail_sales`
--

CREATE TABLE `retail_sales` (
  `id` int(11) NOT NULL,
  `shift_id` int(11) NOT NULL,
  `total_amount` decimal(10,2) DEFAULT 0.00,
  `profit_amount` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `retail_sales`
--

INSERT INTO `retail_sales` (`id`, `shift_id`, `total_amount`, `profit_amount`, `created_at`) VALUES
(1, 1, 50.00, 50.00, '2026-04-12 17:46:26'),
(2, 1, 100.00, 100.00, '2026-04-12 17:47:21'),
(3, 2, 1300.00, 1300.00, '2026-04-13 10:33:36'),
(4, 3, 420.00, 420.00, '2026-04-13 10:43:03'),
(5, 4, 400.00, 400.00, '2026-04-13 10:44:53'),
(6, 5, 420.00, 420.00, '2026-04-13 11:01:43'),
(7, 6, 0.00, 0.00, '2026-04-13 11:18:01'),
(8, 7, 1100.00, 1100.00, '2026-04-13 11:27:13'),
(9, 8, 400.00, 400.00, '2026-04-13 11:35:27'),
(10, 9, 500.00, 500.00, '2026-04-13 11:43:45'),
(11, 10, 450.00, 450.00, '2026-04-13 11:48:55'),
(12, 11, 500.00, 500.00, '2026-04-13 12:03:01'),
(13, 12, 70.00, 20.00, '2026-04-13 12:08:02'),
(14, 13, 400.00, 400.00, '2026-04-13 14:47:33'),
(15, 14, 350.00, 140.00, '2026-04-13 16:10:53'),
(16, 15, 2600.00, 760.00, '2026-04-22 17:52:38');

-- --------------------------------------------------------

--
-- Table structure for table `retail_sale_items`
--

CREATE TABLE `retail_sale_items` (
  `id` int(11) NOT NULL,
  `sale_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL,
  `cost_price` decimal(10,2) NOT NULL,
  `selling_price` decimal(10,2) NOT NULL,
  `profit_amount` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `retail_sale_items`
--

INSERT INTO `retail_sale_items` (`id`, `sale_id`, `product_id`, `qty`, `cost_price`, `selling_price`, `profit_amount`) VALUES
(1, 1, 8, 1, 0.00, 50.00, 50.00),
(2, 2, 8, 1, 0.00, 100.00, 100.00),
(3, 3, 47, 1, 0.00, 500.00, 500.00),
(4, 3, 22, 2, 0.00, 400.00, 800.00),
(5, 4, 47, 1, 0.00, 420.00, 420.00),
(6, 5, 47, 1, 0.00, 400.00, 400.00),
(7, 6, 47, 1, 0.00, 420.00, 420.00),
(8, 7, 47, 1, 0.00, 0.00, 0.00),
(9, 7, 22, 1, 0.00, 0.00, 0.00),
(10, 8, 47, 1, 0.00, 500.00, 500.00),
(11, 8, 22, 1, 0.00, 600.00, 600.00),
(12, 9, 47, 1, 0.00, 400.00, 400.00),
(13, 10, 47, 1, 0.00, 500.00, 500.00),
(14, 11, 47, 1, 0.00, 450.00, 450.00),
(15, 12, 47, 1, 0.00, 500.00, 500.00),
(16, 13, 17, 1, 50.00, 70.00, 20.00),
(17, 14, 47, 1, 0.00, 400.00, 400.00),
(18, 15, 12, 1, 200.00, 250.00, 50.00),
(19, 15, 28, 1, 10.00, 100.00, 90.00),
(20, 16, 29, 1, 40.00, 200.00, 160.00),
(21, 16, 33, 2, 900.00, 1200.00, 600.00);

-- --------------------------------------------------------

--
-- Table structure for table `retail_shifts`
--

CREATE TABLE `retail_shifts` (
  `id` int(11) NOT NULL,
  `opened_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `closed_at` timestamp NULL DEFAULT NULL,
  `status` enum('OPEN','CLOSED') DEFAULT 'OPEN'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `retail_shifts`
--

INSERT INTO `retail_shifts` (`id`, `opened_at`, `closed_at`, `status`) VALUES
(1, '2026-04-12 17:46:02', '2026-04-12 17:47:27', 'CLOSED'),
(2, '2026-04-12 17:47:45', '2026-04-13 10:34:23', 'CLOSED'),
(3, '2026-04-13 10:42:33', '2026-04-13 10:43:08', 'CLOSED'),
(4, '2026-04-13 10:44:36', '2026-04-13 10:44:59', 'CLOSED'),
(5, '2026-04-13 11:01:10', '2026-04-13 11:01:52', 'CLOSED'),
(6, '2026-04-13 11:02:24', '2026-04-13 11:18:05', 'CLOSED'),
(7, '2026-04-13 11:26:32', '2026-04-13 11:27:18', 'CLOSED'),
(8, '2026-04-13 11:35:06', '2026-04-13 11:35:32', 'CLOSED'),
(9, '2026-04-13 11:37:16', '2026-04-13 11:43:50', 'CLOSED'),
(10, '2026-04-13 11:48:37', '2026-04-13 11:49:00', 'CLOSED'),
(11, '2026-04-13 12:02:45', '2026-04-13 12:03:05', 'CLOSED'),
(12, '2026-04-13 12:07:45', '2026-04-13 12:08:06', 'CLOSED'),
(13, '2026-04-13 14:46:56', '2026-04-13 14:47:45', 'CLOSED'),
(14, '2026-04-13 16:08:24', '2026-04-13 16:10:57', 'CLOSED'),
(15, '2026-04-22 17:51:44', '2026-04-22 17:52:44', 'CLOSED');

-- --------------------------------------------------------

--
-- Table structure for table `staff`
--

CREATE TABLE `staff` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `role` varchar(100) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `status` enum('active','leave') DEFAULT 'active',
  `base_salary` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `staff`
--

INSERT INTO `staff` (`id`, `name`, `role`, `phone`, `email`, `status`, `base_salary`, `created_at`) VALUES
(1, 'Ahmed Hassan', 'Warehouse Manager', '010-0001-0001', 'ahmed@alquodas.com', 'active', 8000.00, '2026-04-11 13:55:33'),
(2, 'Sara Mahmoud', 'Sales Rep', '010-0002-0002', 'sara@alquodas.com', 'active', 5500.00, '2026-04-11 13:55:33'),
(3, 'Omar Farouk', 'Pharmacist', '010-0003-0003', 'omar@alquodas.com', 'active', 7000.00, '2026-04-11 13:55:33');

-- --------------------------------------------------------

--
-- Table structure for table `supplier_transactions`
--

CREATE TABLE `supplier_transactions` (
  `id` int(11) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `import_log_id` int(11) DEFAULT NULL,
  `total_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `transaction_type` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `supplier_transactions`
--

INSERT INTO `supplier_transactions` (`id`, `supplier_id`, `import_log_id`, `total_amount`, `transaction_type`, `created_at`) VALUES
(1, NULL, 1, 2500.00, 'IMPORT_CHARGE', '2026-04-11 16:23:52'),
(2, NULL, 2, 500.00, 'IMPORT_CHARGE', '2026-04-11 17:20:27'),
(3, 8, 3, 2480.00, 'IMPORT_CHARGE', '2026-04-12 13:03:31'),
(4, 8, 4, 4620.00, 'IMPORT_CHARGE', '2026-04-12 13:03:31'),
(5, 8, 5, 2088.00, 'IMPORT_CHARGE', '2026-04-12 13:03:31'),
(6, 8, 6, 310.00, 'IMPORT_CHARGE', '2026-04-12 13:16:55'),
(7, 8, 7, 385.00, 'IMPORT_CHARGE', '2026-04-13 11:29:11'),
(8, 9, 8, 500.00, 'IMPORT_CHARGE', '2026-04-13 12:07:37'),
(9, 10, 9, 2000.00, 'IMPORT_CHARGE', '2026-04-13 16:08:06'),
(10, 10, 10, 500.00, 'IMPORT_CHARGE', '2026-04-13 16:08:06'),
(11, 10, 11, 5000.00, 'IMPORT_CHARGE', '2026-04-14 21:48:09'),
(12, 10, 12, 400.00, 'IMPORT_CHARGE', '2026-04-22 15:16:04'),
(13, 10, 13, 40.00, 'IMPORT_CHARGE', '2026-04-22 15:18:23'),
(14, 10, 14, 40.00, 'IMPORT_CHARGE', '2026-04-22 15:41:46'),
(15, 10, 15, 40.00, 'IMPORT_CHARGE', '2026-04-22 16:03:04'),
(16, 10, 16, 400.00, 'IMPORT_CHARGE', '2026-04-22 16:16:44'),
(17, 10, 17, 1000.00, 'IMPORT_CHARGE', '2026-04-22 16:17:22'),
(18, 10, 18, 599.98, 'IMPORT_CHARGE', '2026-04-22 16:38:11'),
(19, 10, 19, 900.00, 'IMPORT_CHARGE', '2026-04-22 17:35:39'),
(20, 10, 20, 900.00, 'IMPORT_CHARGE', '2026-04-22 17:36:28'),
(21, 10, 21, 40.00, 'IMPORT_CHARGE', '2026-04-22 17:37:24'),
(22, 10, 22, 40.00, 'IMPORT_CHARGE', '2026-04-22 17:38:05'),
(23, 10, 23, 900.00, 'IMPORT_CHARGE', '2026-04-22 17:49:51'),
(24, 8, 24, 900.00, 'IMPORT_CHARGE', '2026-04-22 18:04:06');

-- --------------------------------------------------------

--
-- Table structure for table `transfer_logs`
--

CREATE TABLE `transfer_logs` (
  `id` int(11) NOT NULL,
  `from_warehouse_id` int(11) DEFAULT NULL,
  `to_warehouse_id` int(11) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `transferred_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transfer_logs`
--

INSERT INTO `transfer_logs` (`id`, `from_warehouse_id`, `to_warehouse_id`, `product_id`, `quantity`, `transferred_at`) VALUES
(1, 6, 7, 8, 1, '2026-04-11 17:07:48'),
(2, 6, 7, 8, 8, '2026-04-11 17:10:08'),
(3, 6, 7, 8, 1, '2026-04-11 17:29:11'),
(4, 6, 7, 48, 10, '2026-04-12 13:25:30'),
(5, 6, 7, 47, 6, '2026-04-12 13:25:30'),
(6, 6, 7, 22, 1, '2026-04-12 13:25:30'),
(7, 7, 6, 47, 5, '2026-04-13 11:37:53'),
(8, 7, 6, 12, 5, '2026-04-13 16:09:21'),
(9, 7, 6, 28, 10, '2026-04-13 16:09:21');

-- --------------------------------------------------------

--
-- Table structure for table `uom`
--

CREATE TABLE `uom` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `uom`
--

INSERT INTO `uom` (`id`, `name`) VALUES
(5, 'Ampoule'),
(3, 'Bottle'),
(2, 'Box'),
(8, 'Piece'),
(7, 'Sachet'),
(6, 'Strip'),
(1, 'Tablet'),
(4, 'Vial');

-- --------------------------------------------------------

--
-- Table structure for table `warehouses`
--

CREATE TABLE `warehouses` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `capacity` int(11) NOT NULL DEFAULT 10000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `warehouses`
--

INSERT INTO `warehouses` (`id`, `name`, `location`, `capacity`, `created_at`) VALUES
(6, 'المحل', 'السيل', 100000, '2026-04-11 16:22:02'),
(7, 'المخزن', 'السيل', 100000, '2026-04-11 16:58:16');

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_inventory`
--

CREATE TABLE `warehouse_inventory` (
  `id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `batch_number` varchar(100) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `current_stock` int(11) NOT NULL DEFAULT 0,
  `qty_threshold` int(11) NOT NULL DEFAULT 20,
  `expiry_month_threshold` int(11) NOT NULL DEFAULT 3,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `unit_price` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `warehouse_inventory`
--

INSERT INTO `warehouse_inventory` (`id`, `warehouse_id`, `product_id`, `batch_number`, `expiry_date`, `current_stock`, `qty_threshold`, `expiry_month_threshold`, `created_at`, `unit_price`) VALUES
(8, 6, 8, NULL, '2027-01-02', 36, 10, 9, '2026-04-11 16:23:52', NULL),
(15, 6, 8, NULL, '2028-02-23', 6, 20, 5, '2026-04-11 17:20:27', NULL),
(16, 7, 8, NULL, '2027-01-02', 0, 10, 9, '2026-04-11 17:29:11', NULL),
(17, 6, 22, NULL, NULL, 0, 4, 100, '2026-04-12 13:03:31', NULL),
(18, 6, 47, NULL, '2028-01-28', 1, 5, 6, '2026-04-12 13:03:31', NULL),
(19, 6, 48, NULL, NULL, 26, 10, 100, '2026-04-12 13:03:31', NULL),
(20, 7, 48, NULL, NULL, 9, 10, 100, '2026-04-12 13:25:30', NULL),
(21, 7, 47, NULL, '2028-01-28', 0, 5, 6, '2026-04-12 13:25:30', NULL),
(22, 7, 22, NULL, NULL, 1, 4, 100, '2026-04-12 13:25:30', NULL),
(23, 6, 47, NULL, NULL, 0, 20, 3, '2026-04-13 11:29:10', NULL),
(24, 6, 17, NULL, '2028-02-05', 9, 20, 3, '2026-04-13 12:07:37', NULL),
(25, 7, 12, NULL, NULL, 5, 20, 3, '2026-04-13 16:08:06', NULL),
(26, 7, 28, NULL, NULL, 40, 20, 3, '2026-04-13 16:08:06', NULL),
(27, 6, 12, NULL, NULL, 4, 20, 3, '2026-04-13 16:09:21', NULL),
(28, 6, 28, NULL, NULL, 9, 20, 3, '2026-04-13 16:09:21', NULL),
(29, 6, 16, NULL, NULL, 10, 20, 3, '2026-04-14 21:48:09', 500.00),
(33, 7, 33, NULL, NULL, 6, 20, 3, '2026-04-22 16:16:44', 900.00),
(34, 7, 23, NULL, NULL, 2, 20, 3, '2026-04-22 17:37:24', 20.00),
(35, 7, 29, NULL, NULL, 0, 20, 3, '2026-04-22 17:38:05', 40.00);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `client_transactions`
--
ALTER TABLE `client_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ct_pharmacy` (`pharmacy_id`),
  ADD KEY `fk_ct_doctor` (`client_id`);

--
-- Indexes for table `doctors`
--
ALTER TABLE `doctors`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `employee_withdrawals`
--
ALTER TABLE `employee_withdrawals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ew_staff` (`staff_id`);

--
-- Indexes for table `import_logs`
--
ALTER TABLE `import_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_il_product` (`product_id`),
  ADD KEY `fk_il_warehouse` (`warehouse_id`),
  ADD KEY `fk_il_supplier` (`supplier_id`),
  ADD KEY `idx_shipment_id` (`shipment_id`);

--
-- Indexes for table `local_suppliers`
--
ALTER TABLE `local_suppliers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ord_pharmacy` (`pharmacy_id`),
  ADD KEY `fk_ord_warehouse` (`warehouse_id`),
  ADD KEY `fk_ord_doctor` (`client_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_oi_order` (`order_id`),
  ADD KEY `fk_oi_product` (`product_id`),
  ADD KEY `fk_oi_warehouse` (`warehouse_id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `client_id` (`client_id`),
  ADD KEY `pharmacy_id` (`pharmacy_id`);

--
-- Indexes for table `pharmacies`
--
ALTER TABLE `pharmacies`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_prod_base_uom` (`base_uom_id`),
  ADD KEY `fk_prod_bulk_uom` (`bulk_uom_id`);

--
-- Indexes for table `retail_sales`
--
ALTER TABLE `retail_sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `shift_id` (`shift_id`);

--
-- Indexes for table `retail_sale_items`
--
ALTER TABLE `retail_sale_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sale_id` (`sale_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `retail_shifts`
--
ALTER TABLE `retail_shifts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `staff`
--
ALTER TABLE `staff`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `supplier_transactions`
--
ALTER TABLE `supplier_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_st_supplier` (`supplier_id`),
  ADD KEY `fk_st_importlog` (`import_log_id`);

--
-- Indexes for table `transfer_logs`
--
ALTER TABLE `transfer_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `from_warehouse_id` (`from_warehouse_id`),
  ADD KEY `to_warehouse_id` (`to_warehouse_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Indexes for table `uom`
--
ALTER TABLE `uom`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_uom_name` (`name`);

--
-- Indexes for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `warehouse_inventory`
--
ALTER TABLE `warehouse_inventory`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_wi_warehouse` (`warehouse_id`),
  ADD KEY `fk_wi_product` (`product_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `client_transactions`
--
ALTER TABLE `client_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `doctors`
--
ALTER TABLE `doctors`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `employee_withdrawals`
--
ALTER TABLE `employee_withdrawals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `import_logs`
--
ALTER TABLE `import_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `local_suppliers`
--
ALTER TABLE `local_suppliers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `pharmacies`
--
ALTER TABLE `pharmacies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=49;

--
-- AUTO_INCREMENT for table `retail_sales`
--
ALTER TABLE `retail_sales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `retail_sale_items`
--
ALTER TABLE `retail_sale_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `retail_shifts`
--
ALTER TABLE `retail_shifts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `staff`
--
ALTER TABLE `staff`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `supplier_transactions`
--
ALTER TABLE `supplier_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `transfer_logs`
--
ALTER TABLE `transfer_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `uom`
--
ALTER TABLE `uom`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `warehouses`
--
ALTER TABLE `warehouses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `warehouse_inventory`
--
ALTER TABLE `warehouse_inventory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `client_transactions`
--
ALTER TABLE `client_transactions`
  ADD CONSTRAINT `fk_ct_doctor` FOREIGN KEY (`client_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ct_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `employee_withdrawals`
--
ALTER TABLE `employee_withdrawals`
  ADD CONSTRAINT `fk_ew_staff` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `import_logs`
--
ALTER TABLE `import_logs`
  ADD CONSTRAINT `fk_il_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_il_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `local_suppliers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_il_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_ord_doctor` FOREIGN KEY (`client_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ord_pharmacy` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ord_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_oi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_oi_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`pharmacy_id`) REFERENCES `pharmacies` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_prod_base_uom` FOREIGN KEY (`base_uom_id`) REFERENCES `uom` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_prod_bulk_uom` FOREIGN KEY (`bulk_uom_id`) REFERENCES `uom` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `retail_sales`
--
ALTER TABLE `retail_sales`
  ADD CONSTRAINT `retail_sales_ibfk_1` FOREIGN KEY (`shift_id`) REFERENCES `retail_shifts` (`id`);

--
-- Constraints for table `retail_sale_items`
--
ALTER TABLE `retail_sale_items`
  ADD CONSTRAINT `retail_sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `retail_sales` (`id`),
  ADD CONSTRAINT `retail_sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `supplier_transactions`
--
ALTER TABLE `supplier_transactions`
  ADD CONSTRAINT `fk_st_importlog` FOREIGN KEY (`import_log_id`) REFERENCES `import_logs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_st_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `local_suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `transfer_logs`
--
ALTER TABLE `transfer_logs`
  ADD CONSTRAINT `transfer_logs_ibfk_1` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `transfer_logs_ibfk_2` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `transfer_logs_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `warehouse_inventory`
--
ALTER TABLE `warehouse_inventory`
  ADD CONSTRAINT `fk_wi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_wi_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
