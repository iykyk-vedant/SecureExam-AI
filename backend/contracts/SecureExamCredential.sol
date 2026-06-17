// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SecureExamCredential
 * @dev Smart Contract to store hashes of student exam certificates to ensure immutability and prevent tampering.
 */
contract SecureExamCredential {
    address public owner;

    // Mapping from Student UID to an array of Certificate Hashes
    mapping(string => string[]) private studentCertificates;

    // Mapping from Certificate Hash to Exam ID to verify validity
    mapping(string => string) private certificateExamMap;

    event CredentialMinted(string indexed studentUid, string indexed examId, string certificateHash, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Mints a new credential on-chain by storing the certificate hash.
     * @param studentUid The Firebase UID of the student
     * @param examId The UUID of the exam
     * @param certificateHash The SHA-256 hash of the generated certificate document or data
     */
    function mintCredential(string memory studentUid, string memory examId, string memory certificateHash) public onlyOwner {
        require(bytes(certificateExamMap[certificateHash]).length == 0, "Credential hash already exists");

        studentCertificates[studentUid].push(certificateHash);
        certificateExamMap[certificateHash] = examId;

        emit CredentialMinted(studentUid, examId, certificateHash, block.timestamp);
    }

    /**
     * @dev Retrieves all certificate hashes for a given student
     */
    function getStudentCredentials(string memory studentUid) public view returns (string[] memory) {
        return studentCertificates[studentUid];
    }

    /**
     * @dev Verifies if a given certificate hash exists and returns the associated examId
     */
    function verifyCredential(string memory certificateHash) public view returns (bool isValid, string memory examId) {
        string memory linkedExam = certificateExamMap[certificateHash];
        if (bytes(linkedExam).length > 0) {
            return (true, linkedExam);
        }
        return (false, "");
    }
}
