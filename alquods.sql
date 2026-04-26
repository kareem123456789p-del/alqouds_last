
-- ===================== EMPLOYEE =====================
CREATE TABLE employee (
    em_id INT PRIMARY KEY AUTO_INCREMENT,
    em_name VARCHAR(100),
    em_phone VARCHAR(20),
    em_address VARCHAR(255),
    em_job_title VARCHAR(100),
    salary DECIMAL(10,2)
);

-- ===================== DOCTORS =====================
CREATE TABLE doctors (
    dr_id INT PRIMARY KEY AUTO_INCREMENT,
    dr_name VARCHAR(100),
    dr_specialation VARCHAR(100),
    dr_phone VARCHAR(20),
    dr_address VARCHAR(255)
);

-- ===================== PHARMACY =====================
CREATE TABLE pharmacy (
    ph_id INT PRIMARY KEY AUTO_INCREMENT,
    ph_name VARCHAR(100),
    ph_phone VARCHAR(20),
    ph_address VARCHAR(255),
    ph_license_number VARCHAR(50)
);

-- ===================== MEDICAL_SUPPLY =====================
CREATE TABLE medical_supply (
    ms_id INT PRIMARY KEY AUTO_INCREMENT,
    ms_name VARCHAR(100),
    ms_price DECIMAL(10,2),
    expiiry_date DATE,
    status VARCHAR(50)
);

-- ===================== WAREHOUSE =====================
CREATE TABLE warehouse (
    wh_id INT PRIMARY KEY AUTO_INCREMENT,
    wh_name VARCHAR(100)
);

-- ===================== SUPPLIER =====================
CREATE TABLE supplier (
    su_id INT PRIMARY KEY AUTO_INCREMENT,
    su_name VARCHAR(100),
    su_country VARCHAR(100),
    su_phone VARCHAR(20)
);

-- ===================== EXPORT CUSTOMER =====================
CREATE TABLE export_customer (
    ec_id INT PRIMARY KEY AUTO_INCREMENT,
    ec_name VARCHAR(100),
    ec_country VARCHAR(100),
    ec_phone VARCHAR(20)
);

-- ===================== STOCK =====================
CREATE TABLE stock (
    st_id INT PRIMARY KEY AUTO_INCREMENT,
    wh_id INT,
    ms_id INT,
    st_quantity INT,
    st_supply VARCHAR(100),
    FOREIGN KEY (wh_id) REFERENCES warehouse(wh_id),
    FOREIGN KEY (ms_id) REFERENCES medical_supply(ms_id)
);

-- ===================== IMPORT =====================
CREATE TABLE import (
    im_id INT PRIMARY KEY AUTO_INCREMENT,
    im_date DATE,
    su_id INT,
    wh_id INT,
    em_id INT,
    FOREIGN KEY (su_id) REFERENCES supplier(su_id),
    FOREIGN KEY (wh_id) REFERENCES warehouse(wh_id),
    FOREIGN KEY (em_id) REFERENCES employee(em_id)
);

-- ===================== IMPORT DETAILS =====================
CREATE TABLE import_details (
    imd_id INT PRIMARY KEY AUTO_INCREMENT,
    im_id INT,
    ms_id INT,
    quantity INT,
    unit_cost DECIMAL(10,2),
    FOREIGN KEY (im_id) REFERENCES import(im_id),
    FOREIGN KEY (ms_id) REFERENCES medical_supply(ms_id)
);

-- ===================== EXPORT =====================
CREATE TABLE export (
    xp_id INT PRIMARY KEY AUTO_INCREMENT,
    xp_date DATE,
    ec_id INT,
    wh_id INT,
    FOREIGN KEY (ec_id) REFERENCES export_customer(ec_id),
    FOREIGN KEY (wh_id) REFERENCES warehouse(wh_id)
);

-- ===================== EXPORT DETAILS =====================
CREATE TABLE export_details (
    epd_id INT PRIMARY KEY AUTO_INCREMENT,
    xp_id INT,
    ms_id INT,
    quantity INT,
    unit_price DECIMAL(10,2),
    FOREIGN KEY (xp_id) REFERENCES export(xp_id),
    FOREIGN KEY (ms_id) REFERENCES medical_supply(ms_id)
);

-- ===================== ORDERS =====================
CREATE TABLE orders (
    ord_id INT PRIMARY KEY AUTO_INCREMENT,
    or_date DATE,
    or_total_price DECIMAL(10,2),
    or_type VARCHAR(50),
    ph_id INT,
    dr_id INT,
    FOREIGN KEY (ph_id) REFERENCES pharmacy(ph_id),
    FOREIGN KEY (dr_id) REFERENCES doctors(dr_id)
);

-- ===================== ORDER DETAILS =====================
CREATE TABLE order_details (
    ord_id INT,
    ms_id INT,
    ord_quantity INT,
    ord_unit_price DECIMAL(10,2),
    ord_returned_qty INT,
    ord_return_reason VARCHAR(255),
    ord_return_date DATE,
    PRIMARY KEY (ord_id, ms_id),
    FOREIGN KEY (ord_id) REFERENCES orders(ord_id),
    FOREIGN KEY (ms_id) REFERENCES medical_supply(ms_id)
);

-- ===================== RETURNS =====================
CREATE TABLE returns (
    ret_id INT PRIMARY KEY AUTO_INCREMENT,
    ret_type VARCHAR(50),
    ret_date DATE,
    em_id INT,
    im_id INT,
    or_id INT,
    FOREIGN KEY (em_id) REFERENCES employee(em_id),
    FOREIGN KEY (im_id) REFERENCES import(im_id),
    FOREIGN KEY (or_id) REFERENCES orders(ord_id)
);

-- ===================== RETURNS DETAILS =====================
CREATE TABLE returns_details (
    retd_id INT PRIMARY KEY AUTO_INCREMENT,
    ret_id INT,
    wh_id INT,
    ms_id INT,
    retd_qty INT,
    retd_reason VARCHAR(255),
    refund_amount DECIMAL(10,2),
    supplier_credit DECIMAL(10,2),
    unit_price DECIMAL(10,2),
    subtotal_refund DECIMAL(10,2),
    FOREIGN KEY (ret_id) REFERENCES returns(ret_id),
    FOREIGN KEY (wh_id) REFERENCES warehouse(wh_id),
    FOREIGN KEY (ms_id) REFERENCES medical_supply(ms_id)
);

-- ===================== EMPLOYEE WITHDRAWAL =====================
CREATE TABLE employee_withdrawal (
    wd_id INT PRIMARY KEY AUTO_INCREMENT,
    wd_amount DECIMAL(10,2),
    wd_date DATE,
    wd_reson VARCHAR(255),
    em_id INT,
    FOREIGN KEY (em_id) REFERENCES employee(em_id)
);
