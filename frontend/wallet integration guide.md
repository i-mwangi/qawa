Step-by-Step Hedera Wallet Connection Integration for Vanilla JavaScript
Here's a comprehensive integration plan for adding Hedera wallet connection functionality to this coffee tree tokenization dApp using vanilla JavaScript, 

Step 1: Install Required Dependencies
First, install the necessary packages via npm:

npm install @hashgraph/hedera-wallet-connect @hashgraph/sdk @walletconnect/types
package.json:14-21 "@hashgraph/hedera-wallet-connect": "2.0.4-canary.3ca04e9.0",
    "@hashgraph/sdk": "^2.72.0",
    "@reown/appkit": "^1.8.4",
    "@reown/appkit-adapter-ethers": "^1.8.4",
    "@reown/appkit-core": "^1.8.4",
    "@walletconnect/sign-client": "2.19.1",
    "@walletconnect/universal-provider": "2.21.5",
    "@walletconnect/utils": "2.19.1",

Step 2: Set Up Configuration
Create a configuration file with your app metadata and project settings:

config.js

Define your app metadata (name, description, URL, icons)
Store the WalletConnect Project ID (get one from https://cloud.reown.com) heres my id 39948bbdaaebec2790629f3e9589793a
Set default RPC URL for Hedera testnet/mainnet index.ts:4-22// Metadata for the app
export const metadata = {
  name: 'Hedera EIP155 & HIP820 Example',
  description: 'Hedera EIP155 & HIP820 Example',
  url: 'https://github.com/hashgraph/hedera-wallet-connect/',
  icons: ['https://avatars.githubusercontent.com/u/31002956'],
}

// Network configurations
export const networks = [
  HederaChainDefinition.Native.Mainnet,
  HederaChainDefinition.Native.Testnet,
  HederaChainDefinition.EVM.Testnet,
  HederaChainDefinition.EVM.Mainnet,
] as [AppKitNetwork, ...AppKitNetwork[]]

// Default RPC URL
export const DEFAULT_RPC_URL =
  'https://testnet.hedera.api.hgraph.io/v1/pk_prod_ab2c41b848c0b568e96a31ef0ca2f2fbaa549470/rpc'
Step 3: Initialize State Management
Create a state object to track your connection status:

state.js

isConnected: boolean
connector: DAppConnector instance
session: WalletConnect session object
signers: array of DAppSigner objects
accountId: connected account ID
isDetectingExtensions: boolean for extension detection status useDAppConnectorV1.ts:12-33 export interface DAppConnectorState {
  isConnected: boolean
  isInitializing: boolean
  connector: DAppConnector | null
  session: SessionTypes.Struct | null
  signers: DAppSigner[]
  accountId: string | null
  error: string | null
  isDetectingExtensions: boolean
}

export function useDAppConnectorV1() {
  const [state, setState] = useState<DAppConnectorState>({
    isConnected: false,
    isInitializing: false,
    connector: null,
    session: null,
    signers: [],
    accountId: null,
    error: null,
    isDetectingExtensions: true,
  })
Step 4: Initialize the DAppConnector
Create a function to initialize the connector:

Key steps:

Get the project ID from localStorage
Create new DAppConnector with metadata, network (TESTNET/MAINNET), project ID, and supported methods
Initialize the connector with error logging
Check for existing sessions to restore previous connections
Store the connector instance in your state useDAppConnectorV1.ts:102-127 // Initialize DAppConnector
  const initializeConnector = useCallback(
    async (checkExistingSession = true) => {
      if (state.connector || state.isInitializing) return state.connector

      setState((prev) => ({ ...prev, isInitializing: true, error: null }))

      try {
        console.log('Initializing V1 DAppConnector...')

        // Get projectId from localStorage (it should exist if user has configured the app)
        const projectId = localStorage.getItem('reownProjectId')
        if (!projectId) {
          throw new Error('Project ID not configured. Please configure the app first.')
        }

        const dAppConnector = new DAppConnector(
          metadata,
          LedgerId.TESTNET,
          projectId,
          Object.values(HederaJsonRpcMethod),
          ['https://walletconnect.hashpack.app'],
        )

        await dAppConnector.init({ logger: 'error' } as Parameters<
          typeof dAppConnector.init
        >[0])
Step 5: Implement Session Restoration
After initialization, check for existing sessions:

Logic:

Access the walletConnectClient from your connector
Get all existing sessions
Look for sessions with the 'hedera' namespace
If found, extract signers and account ID
Update state and store session marker in sessionStorage useDAppConnectorV1.ts:136-174 // Check for existing V1 session after initialization
        if (checkExistingSession) {
          const walletClient = (
            dAppConnector as unknown as {
              walletConnectClient?: { session?: { getAll?: () => unknown[] } }
            }
          )?.walletConnectClient
          const existingSessions = walletClient?.session?.getAll?.() || []

          // Look for V1 sessions (with hedera namespace)
          const v1Session = existingSessions.find(
            (s: unknown) => (s as { namespaces?: { hedera?: unknown } }).namespaces?.hedera,
          )

          if (v1Session) {
            console.log('Restored existing V1 session')
            const { signers, accountId } = updateSigners(
              dAppConnector,
              v1Session as SessionTypes.Struct,
            )

            setState((prev) => ({
              ...prev,
              isConnected: true,
              session: v1Session as SessionTypes.Struct,
              signers,
              accountId,
            }))

            // Update session marker
            sessionStorage.setItem(
              'hwcV1Session',
              JSON.stringify({
                topic: (v1Session as SessionTypes.Struct).topic,
                accountId,
                timestamp: Date.now(),
              }),
            )
          }
        }
Step 6: Detect Browser Extensions
Create a function to get available Hedera wallet extensions:

Implementation:

Access the extensions property from your connector
Filter for available extensions
Deduplicate by extension ID
Sort to prioritize HashPack
Return the list for display useDAppConnectorV1.ts:360-384// Get available extensions
  const getAvailableExtensions = useCallback((): ExtensionData[] => {
    if (!state.connector) return []
    const extensions =
      (state.connector as unknown as { extensions?: ExtensionData[] }).extensions?.filter(
        (ext: ExtensionData) => ext.available,
      ) || []

    // Deduplicate extensions by ID
    const uniqueExtensions = extensions.reduce((acc: ExtensionData[], ext: ExtensionData) => {
      if (!acc.find((e: ExtensionData) => e.id === ext.id)) {
        acc.push(ext)
      }
      return acc
    }, [])

    // Sort extensions to put HashPack first
    return uniqueExtensions.sort((a: ExtensionData, b: ExtensionData) => {
      const aIsHashPack = a.name?.toLowerCase().includes('hashpack') || false
      const bIsHashPack = b.name?.toLowerCase().includes('hashpack') || false

      if (aIsHashPack && !bIsHashPack) return -1
      if (!aIsHashPack && bIsHashPack) return 1
      return 0
    })
  }, [state.connector])
Step 7: Build Connection UI
Create a connection modal with two options:

HTML Structure:

Browser Extensions Section:
Display loading state while detecting
Show list of available extensions with icons
Each extension gets a clickable button
QR Code Section:
Button to show WalletConnect QR modal
For mobile wallet connections V1ConnectionModal.tsx:123-240 <div className="extensions-section" style={{ marginBottom: '20px' }}>
          <h3>Browser Extensions</h3>
          {isDetectingExtensions ? (
            <div
              className="extensions-loading"
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#666',
                fontStyle: 'italic',
              }}
            >
              Detecting browser extensions...
            </div>
          ) : availableExtensions.length > 0 ? (
            <div className="extensions-list">
              {availableExtensions.map((ext) => (
                <button
                  key={ext.id}
                  onClick={() => handleExtensionConnection(ext)}
                  disabled={isConnecting}
                  className="extension-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    margin: '5px 0',
                    width: '100%',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: isConnecting ? 'not-allowed' : 'pointer',
                    opacity: isConnecting ? 0.5 : 1,
                  }}
                >
                  {ext.icon && (
                    <img
                      src={ext.icon}
                      alt={ext.name}
                      style={{ width: '24px', height: '24px' }}
                    />
                  )}
                  <span>{ext.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div
              className="no-extensions"
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#666',
                fontSize: '14px',
                backgroundColor: '#f9f9f9',
                borderRadius: '4px',
              }}
            >
              No browser extensions detected. Make sure you have a HWC v1 compatible wallet
              extension installed and enabled.
            </div>
          )}
        </div>

        <div
          className="divider"
          style={{
            margin: '20px 0',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <span
            style={{
              backgroundColor: 'white',
              padding: '0 10px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            OR
          </span>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '1px',
              backgroundColor: '#ddd',
              zIndex: 0,
            }}
          ></div>
        </div>

        <div className="qr-section" style={{ textAlign: 'center' }}>
          <h3>Connect with QR Code</h3>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            Scan with a HWC v1 compatible wallet
          </p>
          <button
            onClick={handleQRConnection}
            disabled={isConnecting}
            className="connect-button"
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#7B3FF2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isConnecting ? 'not-allowed' : 'pointer',
              opacity: isConnecting ? 0.5 : 1,
            }}
          >
            {isConnecting ? 'Connecting...' : 'Show QR Code'}
          </button>
        </div>
Step 8: Implement Connection Logic
Create two connection methods:

A. Extension Connection:

Call connector.connectExtension(extensionId)
Wait for session to be established
Extract account info from session namespaces
Update signers and state
Save session marker to sessionStorage with key hwcV1Session
B. QR Code Connection:

Call connector.openModal() - this opens WalletConnect QR modal
Wait for user to scan and approve
Extract session and account info
Update state and save session marker useDAppConnectorV1.ts:200-314  // Connect wallet
  const connect = useCallback(
    async (extensionData?: ExtensionData[]): Promise<boolean> => {
      const connector = state.connector || (await initializeConnector())
      if (!connector) return false

      setState((prev) => ({ ...prev, error: null }))

      try {
        let session: SessionTypes.Struct | null = null

        if (extensionData && extensionData.length > 0) {
          // Connect with extension
          console.log('🔗 V1 Connection: Connecting via extension', {
            extensionId: extensionData[0].id,
            extensionName: extensionData[0].name,
          })

          try {
            session = await connector.connectExtension(extensionData[0].id)
          } catch (error) {
            if (
              error instanceof Error &&
              (error.message.includes('Expired') || error.message.includes('expired'))
            ) {
              throw new Error('Connection request expired. Please try again.')
            }
            throw error
          }
        } else {
          // Open modal for QR code connection
          console.log('🔗 V1 Connection: Opening modal for QR code connection')

          try {
            // openModal returns a session, not a URI
            session = await connector.openModal()
            if (!session) {
              throw new Error('Failed to establish connection')
            }
            console.log('🔗 V1 Connection: Session established', {
              topic: session.topic,
              peer: session.peer,
            })
          } catch (error) {
            if (
              error instanceof Error &&
              (error.message.includes('Expired') || error.message.includes('expired'))
            ) {
              throw new Error('Connection request expired. Please try again.')
            }
            throw error
          }
        }

        // Get the session if not already set
        if (!session) {
          const walletClient = (
            connector as unknown as {
              walletConnectClient?: { session?: { getAll?: () => unknown[] } }
            }
          ).walletConnectClient
          const sessions = walletClient?.session?.getAll?.() || []
          session = (sessions[0] as SessionTypes.Struct) || null
        }

        if (session) {
          // Log V1 connection payload
          console.log('✅ V1 Connection Established:', {
            topic: session.topic,
            peer: session.peer,
            namespaces: session.namespaces,
            requiredNamespaces: session.requiredNamespaces,
            optionalNamespaces: session.optionalNamespaces,
            sessionProperties: session.sessionProperties,
            expiry: session.expiry,
            acknowledged: session.acknowledged,
            controller: session.controller,
            self: session.self,
          })

          // Log the actual namespace structure
          console.log('📦 V1 Namespaces Detail:', {
            hasHedera: !!session.namespaces?.hedera,
            hasEip155: !!session.namespaces?.eip155,
            hederaAccounts: session.namespaces?.hedera?.accounts,
            hederaMethods: session.namespaces?.hedera?.methods,
            hederaEvents: session.namespaces?.hedera?.events,
            eip155Accounts: session.namespaces?.eip155?.accounts,
            eip155Methods: session.namespaces?.eip155?.methods,
            eip155Events: session.namespaces?.eip155?.events,
          })

          // Update signers after connection
          const { signers, accountId } = updateSigners(connector, session)

          setState((prev) => ({
            ...prev,
            isConnected: true,
            session,
            signers,
            accountId,
            connector,
          }))

          // Save V1 session marker to storage
          sessionStorage.setItem(
            'hwcV1Session',
            JSON.stringify({
              topic: session.topic,
              accountId,
              timestamp: Date.now(),
            }),
          )

          return true
        }
Step 9: Extract Signer from Session
After connection, get the signer for transactions:

Process:

Extract account ID from session namespaces (check both hedera and eip155)
Try multiple methods to get signer:
Method 1: Use connector.getSigner(accountId)
Method 2: Call connector.getSigners() and take first
Method 3: Use session topic
Store signers array in state useDAppConnectorV1.ts:36-99 // Update signers when session changes
  const updateSigners = useCallback(
    (connector: DAppConnector, session: SessionTypes.Struct | null) => {
      if (!connector || !session) {
        return { signers: [], accountId: null }
      }

      try {
        // Get account from session
        const accountIdStr =
          session.namespaces?.hedera?.accounts?.[0]?.split(':').pop() ||
          session.namespaces?.eip155?.accounts?.[0]?.split(':').pop() ||
          null

        if (!accountIdStr) {
          console.warn('No account found in session')
          return { signers: [], accountId: null }
        }

        // Try different methods to get the signer
        let signer: DAppSigner | null = null

        // Method 1: Try with AccountId object
        try {
          const accountId = AccountId.fromString(accountIdStr)
          signer = connector.getSigner(accountId as unknown as AccountId)
        } catch {
          console.log('Method 1 failed, trying method 2')
        }

        // Method 2: Try getting all signers
        if (!signer) {
          try {
            const allSigners =
              (connector as unknown as { getSigners?: () => DAppSigner[] }).getSigners?.() || []
            signer = allSigners[0] || null
          } catch {
            console.log('Method 2 failed, trying method 3')
          }
        }

        // Method 3: Try with session topic
        if (!signer && session.topic) {
          try {
            signer =
              (
                connector as unknown as { getSigner?: (topic: string) => DAppSigner }
              ).getSigner?.(session.topic) || null
          } catch {
            console.log('Method 3 failed')
          }
        }

        const signers = signer ? [signer] : []

        console.log('Signers updated:', { accountId: accountIdStr, signerAvailable: !!signer })

        return { signers, accountId: accountIdStr }
      } catch (error) {
        console.error('Error updating signers:', error)
        return { signers: [], accountId: null }
      }
    },
    [],
  )
Step 10: Implement Transaction Methods
Create methods for your coffee tree tokenization transactions:

A. Sign Transaction (for approval before execution):

Create a TransferTransaction with Hedera SDK
Set transaction ID, transfers, and max fee
Call signer.signTransaction(transaction)
Store signed transaction in state for later execution useV1Methods.ts:155-194       case 'hedera_signTransaction': {
            if (!params?.recipientId || !params?.amount || !params?.maxFee) {
              throw new Error('Missing required parameters: recipientId, amount, maxFee')
            }

            const accountId = signer.getAccountId()
            if (!accountId) throw new Error('Account ID not available')

            const hbarAmount = new Hbar(Number(params.amount))
            const recipientAccountId = AccountId.fromString(params.recipientId)
            const transaction = new TransferTransaction()
              .setTransactionId(TransactionId.generate(accountId.toString()))
              .addHbarTransfer(accountId.toString(), hbarAmount.negated())
              .addHbarTransfer(recipientAccountId, hbarAmount)
              .setMaxTransactionFee(new Hbar(Number(params.maxFee)))

            const signedTx = await signer.signTransaction(transaction as Transaction)
            console.log('Signed transaction type:', typeof signedTx, signedTx)
            console.log(
              'Has executeWithSigner?',
              typeof (signedTx as Transaction & { executeWithSigner?: unknown })
                ?.executeWithSigner,
            )
            if (setSignedTransaction) {
              setSignedTransaction(signedTx)
            }

            result = {
              success: true,
              message:
                'Transaction signed successfully. Use hedera_executeTransaction to submit.',
              details: {
                from: accountId.toString(),
                to: params.recipientId,
                amount: `${params.amount} HBAR`,
                maxFee: `${params.maxFee} HBAR`,
              },
            }
            return result
          }
B. Execute Transaction:

Retrieve stored signed transaction from state
Call signedTransaction.executeWithSigner(signer)
Get receipt with txResponse.getReceiptWithSigner(signer)
Return transaction ID and status
Clear signed transaction from state useV1Methods.ts:196-235       case 'hedera_executeTransaction': {
            console.log(
              'Attempting to execute transaction, signedTransaction:',
              signedTransaction,
            )
            if (!signedTransaction) {
              throw new Error(
                'No signed transaction available. Use hedera_signTransaction first.',
              )
            }

            const txResponse = await (
              signedTransaction as Transaction & {
                executeWithSigner: (
                  signer: DAppSigner,
                ) => Promise<{
                  getReceiptWithSigner: (
                    signer: DAppSigner,
                  ) => Promise<{ status: { toString: () => string } }>
                  transactionId?: { toString: () => string }
                }>
              }
            ).executeWithSigner(signer)
            const receipt = await txResponse.getReceiptWithSigner(signer)

            if (setTransactionId && txResponse.transactionId) {
              setTransactionId(txResponse.transactionId.toString())
            }

            // Clear the signed transaction after execution
            if (setSignedTransaction) {
              setSignedTransaction(null)
            }

            result = {
              transactionId: txResponse.transactionId?.toString(),
              status: receipt.status.toString(),
            }
            return result
          }
C. Sign and Execute in One Step (alternative):

Create transaction
Convert to base64 string using transactionToBase64String
Call connector.signAndExecuteTransaction() with account ID and transaction list
Single wallet approval required useV1Methods.ts:250-291      case 'hedera_signAndExecuteTransaction': {
            if (!params?.recipientId || !params?.amount) {
              throw new Error('Missing required parameters: recipientId, amount')
            }

            const accountId = signer.getAccountId()
            if (!accountId) throw new Error('Account ID not available')

            const hbarAmount = new Hbar(Number(params.amount))
            const recipientAccountId = AccountId.fromString(params.recipientId)
            const transaction = new TransferTransaction()
              .setTransactionId(TransactionId.generate(accountId.toString()))
              .addHbarTransfer(accountId.toString(), hbarAmount.negated())
              .addHbarTransfer(recipientAccountId, hbarAmount)
              .setMaxTransactionFee(new Hbar(1)) // Default max fee of 1 HBAR

            // Use the wallet's native signAndExecuteTransaction method
            // This will make a single request to the wallet
            const transactionList = transactionToBase64String(transaction as Transaction)

            // Call the wallet directly through the connector
            if (!connector) {
              throw new Error('Connector not available')
            }

            // Pass the correct params format expected by DAppConnector
            const walletResponse = await connector.signAndExecuteTransaction({
              signerAccountId: accountId.toString(),
              transactionList: transactionList,
            })

            const response = walletResponse as { transactionId?: string }
            if (setTransactionId && response?.transactionId) {
              setTransactionId(response.transactionId)
            }

            result = {
              transactionId: response?.transactionId,
              status: 'SUCCESS',
            }
            return result
          }
Step 11: Implement Disconnect
Create a disconnect function:

Steps:

Get session topic from current session
Call connector.disconnect(topic)
Remove hwcV1Session from sessionStorage
Clear all state (isConnected, session, signers, accountId) useDAppConnectorV1.ts:330-357 // Disconnect wallet
  const disconnect = useCallback(async () => {
    if (!state.connector) return

    try {
      const topic = state.session?.topic || ''
      await state.connector.disconnect(topic)

      // Clear V1 session from storage
      sessionStorage.removeItem('hwcV1Session')

      setState((prev) => ({
        ...prev,
        isConnected: false,
        session: null,
        signers: [],
        accountId: null,
        error: null,
      }))
    } catch (error) {
      console.error('Disconnect failed:', error)
      // Clear session even on error
      sessionStorage.removeItem('hwcV1Session')
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Disconnect failed',
      }))
    }
  }, [state.connector, state.session])
Step 12: Display Connection Status
Show connection information in your UI:

Display:

Connection status (connected/disconnected)
Protocol version (HWC v1)
Connected account ID
Active network (Testnet/Mainnet)
Active namespaces (Hedera/EIP155)
Session topic (truncated) V1App.tsx:154-256        </div>

        {/* Connection Status */}
        <div
          style={{
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: '#f0f0f0',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#333' }}>
            Connection Information
          </h3>
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: v1Connection.isConnected ? '#00c851' : '#ff4444',
                }}
              />
              <span style={{ fontSize: '14px' }}>
                <strong>Status:</strong>{' '}
                {v1Connection.isConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            {v1Connection.isConnected && (
              <>
                <div style={{ fontSize: '14px' }}>
                  <strong>Protocol:</strong> HWC v1 (Legacy)
                </div>
                <div style={{ fontSize: '14px' }}>
                  <strong>Account ID:</strong>{' '}
                  <code
                    style={{
                      backgroundColor: '#e0e0e0',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {v1Connection.accountId || 'N/A'}
                  </code>
                </div>
                <div style={{ fontSize: '14px' }}>
                  <strong>Network:</strong>{' '}
                  {v1Connection.session?.namespaces?.hedera?.chains?.[0] === 'hedera:mainnet' ||
                  v1Connection.session?.namespaces?.eip155?.chains?.[0] === 'eip155:295'
                    ? 'Mainnet'
                    : 'Testnet'}
                </div>
                <div style={{ fontSize: '14px' }}>
                  <strong>Active Namespaces:</strong>{' '}
                  {[
                    v1Connection.session?.namespaces?.hedera && 'Hedera',
                    v1Connection.session?.namespaces?.eip155 && 'EIP155',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'Hedera'}
                </div>
                <div style={{ fontSize: '14px' }}>
                  <strong>CAIP Address:</strong>{' '}
                  <code
                    style={{
                      backgroundColor: '#e0e0e0',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                    }}
                  >
                    {v1Connection.session?.namespaces?.hedera?.accounts?.[0] ||
                      v1Connection.session?.namespaces?.eip155?.accounts?.[0] ||
                      (v1Connection.accountId
                        ? `hedera:${
                            v1Connection.session?.namespaces?.hedera?.chains?.[0]?.split(
                              ':',
                            )[1] || 'testnet'
                          }:${v1Connection.accountId}`
                        : 'N/A')}
                  </code>
                </div>
                <div style={{ fontSize: '14px' }}>
                  <strong>Session Topic:</strong>{' '}
                  <code
                    style={{
                      backgroundColor: '#e0e0e0',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                    }}
                  >
                    {v1Connection.session?.topic
                      ? `${v1Connection.session.topic.substring(0, 8)}...${v1Connection.session.topic.substring(v1Connection.session.topic.length - 6)}`
                      : 'N/A'}
                  </code>
                </div>
              </>
            )}
          </div>
Step 13: Handle Session Persistence
On app load, check for existing session:

Logic:

Check sessionStorage for hwcV1Session key
Verify no V2 session exists (check selectedHWCv2Namespace)
If V1 session exists, initialize connector to restore it
Don't auto-restore if user hasn't taken action yet useDAppConnectorV1.ts:419-445 // Don't auto-initialize on mount - wait for user action
  // This prevents double initialization with V2
  useEffect(() => {
    const checkExistingSession = async () => {
      // Only check for existing V1 sessions if there's no V2 session
      const v2Namespace = sessionStorage.getItem('selectedHWCv2Namespace')
      if (v2Namespace) {
        console.log('V1 connector skipping - V2 namespace detected')
        return
      }

      // Check if there's an existing V1 session stored
      const existingV1Session = sessionStorage.getItem('hwcV1Session')
      if (existingV1Session) {
        try {
          JSON.parse(existingV1Session)
          console.log(
            'Found existing V1 session data, will restore on first connection attempt',
          )
          // Don't initialize here - wait for user action
        } catch {
          console.error('Invalid V1 session data in storage')
          sessionStorage.removeItem('hwcV1Session')
        }
      }
    }

    checkExistingSession()
  }, []) // Only run on mount
Notes
Important Considerations:

Project ID Required: You must obtain a WalletConnect Project ID from https://cloud.reown.com before connections work. Store it in localStorage with key reownProjectId.

Vanilla JavaScript Adaptation: This repository uses React, so you'll need to convert:

React hooks → regular JavaScript functions with manual state management
React components → vanilla HTML/DOM manipulation
useEffect → regular event listeners and initialization logic
useState → simple JavaScript objects
Session Storage: The V1 implementation uses sessionStorage with key hwcV1Session to persist sessions across page reloads.

Network Support: The code supports both Testnet and Mainnet. Configure via the LedgerId parameter when creating DAppConnector.

Extension Detection Timing: Extensions need ~1000ms to respond to detection queries, so implement appropriate loading states.

Error Handling: Implement try-catch blocks for all connection and transaction methods, especially for expired URI errors.

Coffee Tree Tokenization: For your specific use case, you'd replace the basic HBAR transfers with token operations (TokenCreateTransaction, TokenMintTransaction, TokenAssociateTransaction, etc.) using the same signer pattern.

