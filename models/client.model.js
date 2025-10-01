class Client {
  static async create(clientData, connection) {
    const {
      id,
      orderGiverName,
      orderGiverAccount,
      orderGiverAddress,
      beneficiaryName,
      beneficiaryAccount,
      beneficiaryAddress,
      beneficiaryBankName,
      beneficiaryBankSwift,
      amount,
      amountInWords,
      transferReason,
      transferType
    } = clientData;

    await connection.execute(
      `INSERT INTO clients (
        id, order_giver_name, order_giver_account, order_giver_address,
        beneficiary_name, beneficiary_account, beneficiary_address,
        beneficiary_bank_name, beneficiary_bank_swift, amount,
        amount_in_words, transfer_reason, transfer_type, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En Attente', NOW(), NOW())`,
      [
        id,
        orderGiverName,
        orderGiverAccount,
        orderGiverAddress,
        beneficiaryName,
        beneficiaryAccount,
        beneficiaryAddress,
        beneficiaryBankName,
        beneficiaryBankSwift,
        amount,
        amountInWords,
        transferReason,
        transferType
      ]
    );

    return id;
  }

  static async findById(id, connection) {
    const [rows] = await connection.execute(
      `SELECT 
        id,
        order_giver_name as orderGiverName,
        order_giver_account as orderGiverAccount,
        order_giver_address as orderGiverAddress,
        beneficiary_name as beneficiaryName,
        beneficiary_account as beneficiaryAccount,
        beneficiary_address as beneficiaryAddress,
        beneficiary_bank_name as beneficiaryBankName,
        beneficiary_bank_swift as beneficiaryBankSwift,
        amount,
        amount_in_words as amountInWords,
        transfer_reason as transferReason,
        status,
        transfer_type as transferType,
        created_at as createdAt,
        updated_at as updatedAt
      FROM clients 
      WHERE id = ?`, 
      [id]
    );
    return rows[0];
  }

  /**
   * Find all clients with a specific status
   * @param {string} status - The status to filter by
   * @param {object} connection - Database connection
   * @returns {Promise<Array>} - Array of client objects
   */
  static async findByStatus(status, connection) {
    const [rows] = await connection.execute(
      `SELECT 
        id,
        order_giver_name as orderGiverName,
        order_giver_account as orderGiverAccount,
        beneficiary_name as beneficiaryName,
        beneficiary_account as beneficiaryAccount,
        amount,
        transfer_type as transferType,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      FROM clients 
      WHERE status = ?
      ORDER BY created_at DESC`, 
      [status]
    );
    return rows;
  }

  static async findAll(connection) {
    const [rows] = await connection.execute(
      `SELECT 
        id,
        order_giver_name as orderGiverName,
        order_giver_account as orderGiverAccount,
        beneficiary_name as beneficiaryName,
        beneficiary_account as beneficiaryAccount,
        amount,
        transfer_type as transferType,
        status,
        created_at as createdAt
      FROM clients 
      ORDER BY created_at DESC`
    );
    return rows;
  }

  static async delete(id, connection) {
    const [result] = await connection.execute(
      'DELETE FROM clients WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  static async update(id, clientData, connection) {
    const {
      orderGiverName,
      orderGiverAccount,
      orderGiverAddress,
      beneficiaryName,
      beneficiaryAccount,
      beneficiaryAddress,
      beneficiaryBankName,
      beneficiaryBankSwift,
      amount,
      amountInWords,
      transferReason,
      transferType,
      status
    } = clientData;

    const [result] = await connection.execute(
      `UPDATE clients SET
        order_giver_name = ?,
        order_giver_account = ?,
        order_giver_address = ?,
        beneficiary_name = ?,
        beneficiary_account = ?,
        beneficiary_address = ?,
        beneficiary_bank_name = ?,
        beneficiary_bank_swift = ?,
        amount = ?,
        amount_in_words = ?,
        transfer_reason = ?,
        transfer_type = ?,
        status = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        orderGiverName,
        orderGiverAccount,
        orderGiverAddress,
        beneficiaryName,
        beneficiaryAccount,
        beneficiaryAddress,
        beneficiaryBankName,
        beneficiaryBankSwift,
        amount,
        amountInWords,
        transferReason,
        transferType,
        status || 'En Attente',
        id
      ]
    );

    return result.affectedRows > 0;
  }
}

module.exports = Client;
