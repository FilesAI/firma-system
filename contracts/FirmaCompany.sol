// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract FirmaCompany is AccessControl {
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    // ====== Events ======
    event AgentRegistered(uint256 indexed agentId, string role, address wallet);
    event AgentHired(uint256 indexed agentId, string reason);
    event AgentFired(uint256 indexed agentId, string reason);
    event AgentRehired(uint256 indexed agentId, string reason);
    event BudgetUpdated(uint256 indexed agentId, uint256 newBudget, string reason);
    event TreasuryPaused(string reason);
    event TreasuryResumed(string reason);
    event DecisionLogged(uint256 indexed agentId, string decisionType, string detail);
    event OpsReportAnchored(uint256 indexed reportId, bytes32 contentHash, uint256 timestamp);

    // ====== Types ======
    enum Role { Research, Executor, Treasury, Ops }

    struct Agent {
        uint256 agentId;
        Role role;
        string roleName;
        address wallet;
        bool registered;
        bool active;
        uint256 budget;
        uint256 registeredAt;
        uint256 hiredAt;
    }

    // ====== State ======
    mapping(uint256 => Agent) public agents;
    uint256[] public agentIds;
    bool public treasuryActive;
    uint256 public reportCount;

    // ====== Modifiers ======
    modifier whenNotPaused() {
        require(treasuryActive, "Treasury is paused");
        _;
    }

    modifier agentExists(uint256 _agentId) {
        require(agents[_agentId].registered, "Agent not registered");
        _;
    }

    // ====== Constructor ======
    constructor(address _adminWallet, address _treasuryWallet) {
        _grantRole(DEFAULT_ADMIN_ROLE, _adminWallet);
        _grantRole(GOVERNANCE_ROLE, _treasuryWallet);
        treasuryActive = true;
    }

    // ====== Agent Registration (admin only, one-time setup) ======
    function registerAgent(
        uint256 _agentId,
        Role _role,
        string calldata _roleName,
        address _wallet
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!agents[_agentId].registered, "Agent already registered");
        require(_wallet != address(0), "Invalid wallet");

        agents[_agentId] = Agent({
            agentId: _agentId,
            role: _role,
            roleName: _roleName,
            wallet: _wallet,
            registered: true,
            active: false,
            budget: 0,
            registeredAt: block.timestamp,
            hiredAt: 0
        });
        agentIds.push(_agentId);
        emit AgentRegistered(_agentId, _roleName, _wallet);
    }

    // ====== Governance (Treasury Agent via GOVERNANCE_ROLE) ======
    function hireAgent(
        uint256 _agentId,
        string calldata _reason
    ) external onlyRole(GOVERNANCE_ROLE) agentExists(_agentId) whenNotPaused {
        require(!agents[_agentId].active, "Already active");
        agents[_agentId].active = true;
        agents[_agentId].hiredAt = block.timestamp;
        emit AgentHired(_agentId, _reason);
    }

    function fireAgent(
        uint256 _agentId,
        string calldata _reason
    ) external onlyRole(GOVERNANCE_ROLE) agentExists(_agentId) {
        require(agents[_agentId].active, "Already inactive");
        agents[_agentId].active = false;
        emit AgentFired(_agentId, _reason);
    }

    function rehireAgent(
        uint256 _agentId,
        string calldata _reason
    ) external onlyRole(GOVERNANCE_ROLE) agentExists(_agentId) whenNotPaused {
        require(!agents[_agentId].active, "Already active");
        agents[_agentId].active = true;
        agents[_agentId].hiredAt = block.timestamp;
        emit AgentRehired(_agentId, _reason);
    }

    function updateBudget(
        uint256 _agentId,
        uint256 _newBudget,
        string calldata _reason
    ) external onlyRole(GOVERNANCE_ROLE) agentExists(_agentId) whenNotPaused {
        agents[_agentId].budget = _newBudget;
        emit BudgetUpdated(_agentId, _newBudget, _reason);
    }

    function logDecision(
        uint256 _agentId,
        string calldata _decisionType,
        string calldata _detail
    ) external onlyRole(GOVERNANCE_ROLE) agentExists(_agentId) {
        emit DecisionLogged(_agentId, _decisionType, _detail);
    }

    // ====== Treasury Control ======
    function pauseTreasury(
        string calldata _reason
    ) external onlyRole(GOVERNANCE_ROLE) {
        treasuryActive = false;
        emit TreasuryPaused(_reason);
    }

    function resumeTreasury(
        string calldata _reason
    ) external onlyRole(GOVERNANCE_ROLE) {
        require(!treasuryActive, "Already active");
        treasuryActive = true;
        emit TreasuryResumed(_reason);
    }

    // ====== Ops Report Anchoring ======
    function anchorOpsReport(
        bytes32 _contentHash
    ) external onlyRole(GOVERNANCE_ROLE) {
        reportCount++;
        emit OpsReportAnchored(reportCount, _contentHash, block.timestamp);
    }

    // ====== View ======
    function getAgent(uint256 _agentId) external view returns (Agent memory) {
        require(agents[_agentId].registered, "Agent not registered");
        return agents[_agentId];
    }

    function getAgentCount() external view returns (uint256) {
        return agentIds.length;
    }

    function isAgentActive(uint256 _agentId) external view returns (bool) {
        return agents[_agentId].registered && agents[_agentId].active;
    }
}
