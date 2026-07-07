import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Send, ArrowLeft, Shield, MessageSquareX, EyeOff, File as FileIcon, Download, CornerUpLeft, X, Settings as SettingsIcon, Bell, Volume2, Vibrate, Clock, User, CornerDownLeft, Trash2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
  Image as RNImage,
  Modal,
  Switch,
  ScrollView,
} from 'react-native';
import { useUser } from '@/contexts/UserContext';
import { useGroups } from '@/contexts/GroupContext';
import { useChats } from '@/contexts/ChatContext';
import { ChatMessage, ChatFileAttachment, ChatReplyInfo, ChatSettings } from '@/types/event';

export default function ChatRoomScreen() {
  const router = useRouter();
  const { id: groupId, chatId } = useLocalSearchParams<{
    id: string;
    chatId: string;
  }>();
  const { userId } = useUser();
  const { isGroupAdmin } = useGroups();
  const {
    chats,
    subscribeToMessages,
    sendMessage,
    getMessagesForChat,
    chatSettings,
    loadChatSettings,
    updateChatSettings,
  } = useChats();

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [replyTo, setReplyTo] = useState<ChatReplyInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const chat = chats.find((c) => c.id === chatId);
  const messages = getMessagesForChat(chatId!);
  const isAdmin = isGroupAdmin(groupId!);
  const settings: ChatSettings = chatSettings[chatId!] ?? {
    notificationsEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    showTimestamps: true,
    showSenderNames: true,
    enterToSend: false,
  };

  const visibility = chat?.visibility ?? 'open';
  const isAdminOnly = visibility === 'admin-only';
  const isReadonly = visibility === 'readonly';
  const canView = !isAdminOnly || isAdmin;
  const canType = visibility === 'open' || (isReadonly && isAdmin) || (isAdminOnly && isAdmin);

  useEffect(() => {
    if (!chatId) return;
    loadChatSettings(chatId).catch(() => {});
  }, [chatId, loadChatSettings]);

  useEffect(() => {
    if (!chatId || !canView) return;
    const unsub = subscribeToMessages(chatId);
    return () => {
      unsub();
    };
  }, [chatId, subscribeToMessages, canView]);

  useEffect(() => {
    if (messages.length > 0 && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [messages, isInitialLoad]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!chatId) return;
    setIsSending(true);
    try {
      const replyInfo = replyTo ?? undefined;
      await sendMessage(chatId, trimmed, replyInfo);
      setText('');
      setReplyTo(null);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      Alert.alert('Send failed', error?.message || 'Could not send your message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = useCallback((message: ChatMessage) => {
    const replyText = message.text?.trim()
      || (message.attachment ? message.attachment.name : '');
    setReplyTo({
      messageId: message.id,
      userName: message.userName,
      text: replyText,
    });
  }, []);

  const cancelReply = useCallback(() => setReplyTo(null), []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleOpenAttachment = useCallback(async (attachment: ChatFileAttachment) => {
    try {
      const supported = await Linking.canOpenURL(attachment.url);
      if (supported) {
        await Linking.openURL(attachment.url);
      } else {
        Alert.alert('Cannot open file', 'No app is available to open this file type.');
      }
    } catch (error: any) {
      console.error('Open attachment failed:', error);
      Alert.alert('Could not open file', error?.message || 'Please try again.');
    }
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderAttachment = (attachment: ChatFileAttachment, isMine: boolean) => {
    const isImage = attachment.type.startsWith('image/');
    if (isImage) {
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOpenAttachment(attachment)}
          style={styles.attachmentImageWrap}
        >
          <RNImage
            source={{ uri: attachment.url }}
            style={styles.attachmentImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleOpenAttachment(attachment)}
        style={[
          styles.fileAttachment,
          isMine ? styles.fileAttachmentMine : styles.fileAttachmentTheirs,
        ]}
      >
        <View
          style={[
            styles.fileIconWrap,
            isMine ? styles.fileIconWrapMine : styles.fileIconWrapTheirs,
          ]}
        >
          <FileIcon size={22} color={isMine ? '#FFF' : '#007AFF'} />
        </View>
        <View style={styles.fileInfo}>
          <Text
            style={[
              styles.fileName,
              isMine ? styles.fileNameMine : styles.fileNameTheirs,
            ]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {attachment.name}
          </Text>
          <Text
            style={[
              styles.fileMeta,
              isMine ? styles.fileMetaMine : styles.fileMetaTheirs,
            ]}
          >
            {formatFileSize(attachment.size)}
          </Text>
        </View>
        <Download size={18} color={isMine ? 'rgba(255,255,255,0.7)' : '#999'} />
      </TouchableOpacity>
    );
  };

  const renderReplyQuote = (reply: ChatReplyInfo, isMine: boolean) => {
    return (
      <View
        style={[
          styles.replyQuote,
          isMine ? styles.replyQuoteMine : styles.replyQuoteTheirs,
        ]}
      >
        <View style={styles.replyQuoteBar} />
        <View style={styles.replyQuoteContent}>
          <Text
            style={[
              styles.replyQuoteAuthor,
              isMine ? styles.replyQuoteAuthorMine : styles.replyQuoteAuthorTheirs,
            ]}
            numberOfLines={1}
          >
            {reply.userName}
          </Text>
          <Text
            style={[
              styles.replyQuoteText,
              isMine ? styles.replyQuoteTextMine : styles.replyQuoteTextTheirs,
            ]}
          >
            {reply.text}
          </Text>
        </View>
      </View>
    );
  };

  const renderSettingRow = ({
    icon: Icon,
    color,
    label,
    description,
    value,
    onToggle,
  }: {
    icon: typeof Bell;
    color: string;
    label: string;
    description: string;
    value: boolean;
    onToggle: (v: boolean) => void;
  }) => (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, { backgroundColor: color + '18' }]}>
        <Icon size={18} color={color} />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E5E5EA', true: '#34C759' }}
        ios_backgroundColor="#E5E5EA"
      />
    </View>
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.userId === userId;
    const hasText = !!(item.text && item.text.trim());
    const hasAttachment = !!item.attachment;
    const hasReply = !!item.replyTo;

    return (
      <TouchableOpacity
        activeOpacity={1}
        onLongPress={() => handleReply(item)}
        delayLongPress={300}
        style={[
          styles.messageRow,
          isMine ? styles.messageRowMine : styles.messageRowTheirs,
        ]}
      >
        {!isMine && settings.showSenderNames && (
          <Text style={styles.messageAuthor}>{item.userName}</Text>
        )}
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs,
            hasAttachment && !hasText && styles.messageBubbleAttachmentOnly,
          ]}
        >
          {hasReply && renderReplyQuote(item.replyTo!, isMine)}
          {hasAttachment && renderAttachment(item.attachment!, isMine)}
          {hasText && (
            <Text
              style={[
                styles.messageText,
                isMine ? styles.messageTextMine : styles.messageTextTheirs,
                hasAttachment && styles.messageTextWithAttachment,
              ]}
            >
              {item.text}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.messageMetaRow,
            isMine ? styles.messageMetaRowMine : styles.messageMetaRowTheirs,
            !settings.showTimestamps && { display: 'none' },
          ]}
        >
          <Text
            style={[
              styles.messageTime,
              isMine ? styles.messageTimeMine : styles.messageTimeTheirs,
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => handleReply(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <CornerUpLeft size={14} color={isMine ? '#007AFF' : '#888'} />
            <Text
              style={[
                styles.replyButtonText,
                isMine ? styles.replyButtonTextMine : styles.replyButtonTextTheirs,
              ]}
            >
              Reply
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (!chat) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Chat' }} />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </View>
    );
  }

  // Non-admin trying to access admin-only chat
  if (!canView) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: chat.name, headerLeft: () => null }} />
        <View style={styles.lockedState}>
          <EyeOff size={48} color="#FF3B30" strokeWidth={1.5} />
          <Text style={styles.lockedTitle}>Admin Only</Text>
          <Text style={styles.lockedSubtitle}>
            This chat is restricted to group admins.
          </Text>
          <TouchableOpacity
            style={styles.lockedBackButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={18} color="#007AFF" />
            <Text style={styles.lockedBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: chat.name,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <ArrowLeft size={22} color="#007AFF" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowSettings(true)}
              style={styles.headerButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <SettingsIcon size={22} color="#007AFF" />
            </TouchableOpacity>
          ),
        }}
      />

      {isReadonly && !isAdmin && (
        <View style={styles.readonlyBanner}>
          <MessageSquareX size={14} color="#FFF" />
          <Text style={styles.readonlyBannerText}>
            Read-only — only admins can send messages
          </Text>
        </View>
      )}

      <View style={styles.retentionBanner}>
        <Text style={styles.retentionBannerText}>
          Messages are kept for 7 days and then permanently deleted.
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        ListEmptyComponent={
          isInitialLoad ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : (
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyMessagesText}>
                No messages yet. Say hello!
              </Text>
            </View>
          )
        }
      />

      {canType ? (
        <View style={styles.inputBar}>
          {replyTo && (
            <View style={styles.replyPreviewBar}>
              <View style={styles.replyPreviewLeft}>
                <CornerUpLeft size={16} color="#007AFF" />
                <View style={styles.replyPreviewContent}>
                  <Text style={styles.replyPreviewAuthor} numberOfLines={1}>
                    Replying to {replyTo.userName}
                  </Text>
                  <Text style={styles.replyPreviewText}>
                    {replyTo.text}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={cancelReply}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#999" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder={'Type a message...'}
              placeholderTextColor="#999"
              multiline
              maxLength={1000}
              returnKeyType={settings.enterToSend ? 'send' : 'default'}
              blurOnSubmit={!settings.enterToSend}
              onSubmitEditing={settings.enterToSend ? handleSend : undefined}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !text.trim() || isSending ? styles.sendButtonDisabled : null,
              ]}
              onPress={handleSend}
              disabled={!text.trim() || isSending}
              activeOpacity={0.7}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Send
                  size={18}
                  color={text.trim() ? '#FFF' : '#CCC'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.inputBarLocked}>
          <Shield size={16} color="#999" />
          <Text style={styles.inputBarLockedText}>
            Only admins can send messages in this chat
          </Text>
        </View>
      )}

      {/* Chat Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.settingsOverlay}>
          <TouchableOpacity
            style={styles.settingsBackdrop}
            activeOpacity={1}
            onPress={() => setShowSettings(false)}
          />
          <View style={styles.settingsSheet}>
            <View style={styles.settingsHandle} />
            <Text style={styles.settingsTitle}>Chat Settings</Text>
            <Text style={styles.settingsChatName}>{chat.name}</Text>

            <ScrollView
              style={styles.settingsScrollView}
              contentContainerStyle={styles.settingsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={settingsSectionLabel}>Notifications</Text>
              {renderSettingRow({
                icon: Bell,
                color: '#FF3B30',
                label: 'Notifications',
                description: 'Get notified about new messages',
                value: settings.notificationsEnabled,
                onToggle: (v) => updateChatSettings(chatId!, { notificationsEnabled: v }),
              })}
              {renderSettingRow({
                icon: Volume2,
                color: '#007AFF',
                label: 'Sound',
                description: 'Play a sound for new messages',
                value: settings.soundEnabled,
                onToggle: (v) => updateChatSettings(chatId!, { soundEnabled: v }),
              })}
              {renderSettingRow({
                icon: Vibrate,
                color: '#5856D6',
                label: 'Vibration',
                description: 'Vibrate when a message arrives',
                value: settings.vibrationEnabled,
                onToggle: (v) => updateChatSettings(chatId!, { vibrationEnabled: v }),
              })}

              <Text style={settingsSectionLabel}>Appearance</Text>
              {renderSettingRow({
                icon: Clock,
                color: '#34C759',
                label: 'Show Timestamps',
                description: 'Display the time under each message',
                value: settings.showTimestamps,
                onToggle: (v) => updateChatSettings(chatId!, { showTimestamps: v }),
              })}
              {renderSettingRow({
                icon: User,
                color: '#FF9500',
                label: 'Show Sender Names',
                description: 'Display who sent each message',
                value: settings.showSenderNames,
                onToggle: (v) => updateChatSettings(chatId!, { showSenderNames: v }),
              })}

              <Text style={settingsSectionLabel}>Input</Text>
              {renderSettingRow({
                icon: CornerDownLeft,
                color: '#5AC8FA',
                label: 'Enter to Send',
                description: 'Press Enter to send instead of adding a new line',
                value: settings.enterToSend,
                onToggle: (v) => updateChatSettings(chatId!, { enterToSend: v }),
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.settingsDoneButton}
              onPress={() => setShowSettings(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const settingsSectionLabel = {
  fontSize: 13,
  fontWeight: '600' as const,
  color: '#8E8E93',
  textTransform: 'uppercase' as const,
  marginBottom: 8,
  marginTop: 18,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  backButton: {
    paddingRight: 8,
  },
  headerButton: {
    paddingHorizontal: 8,
  },
  readonlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9500',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  readonlyBannerText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  retentionBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  retentionBannerText: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  messageRowMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageAuthor: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  replyQuote: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 8,
    borderLeftWidth: 2,
  },
  replyQuoteMine: {
    borderLeftColor: 'rgba(255,255,255,0.5)',
  },
  replyQuoteTheirs: {
    borderLeftColor: '#007AFF',
  },
  replyQuoteBar: {
    width: 0,
  },
  replyQuoteContent: {
    flex: 1,
    marginLeft: 2,
  },
  replyQuoteAuthor: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  replyQuoteAuthorMine: {
    color: 'rgba(255,255,255,0.85)',
  },
  replyQuoteAuthorTheirs: {
    color: '#007AFF',
  },
  replyQuoteText: {
    fontSize: 13,
    marginTop: 1,
    lineHeight: 18,
  },
  replyQuoteTextMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  replyQuoteTextTheirs: {
    color: '#666',
  },
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F0FE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  replyPreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewAuthor: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  replyPreviewText: {
    fontSize: 12,
    color: '#666',
    marginTop: 1,
    lineHeight: 16,
  },
  messageBubbleMine: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 6,
  },
  messageBubbleTheirs: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextMine: {
    color: '#FFF',
  },
  messageTextTheirs: {
    color: '#000',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
    gap: 10,
  },
  messageMetaRowMine: {
    justifyContent: 'flex-end',
  },
  messageMetaRowTheirs: {
    justifyContent: 'flex-start',
  },
  messageTime: {
    fontSize: 11,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#F0F0F2',
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  replyButtonTextMine: {
    color: '#007AFF',
  },
  replyButtonTextTheirs: {
    color: '#888',
  },
  messageTimeMine: {
    color: '#999',
  },
  messageTimeTheirs: {
    color: '#999',
  },
  inputBar: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  attachButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8F0FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingAttachmentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E8F0FE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pendingAttachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  pendingAttachmentName: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600' as const,
    flex: 1,
  },
  pendingAttachmentSize: {
    fontSize: 11,
    color: '#5B9BFF',
  },
  pendingAttachmentRemove: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '600' as const,
    paddingHorizontal: 8,
  },
  attachmentImageWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  attachmentImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  messageBubbleAttachmentOnly: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  messageTextWithAttachment: {
    marginTop: 6,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 10,
    borderRadius: 12,
    minWidth: 200,
  },
  fileAttachmentMine: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  fileAttachmentTheirs: {
    backgroundColor: '#F0F4FF',
  },
  fileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileIconWrapMine: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  fileIconWrapTheirs: {
    backgroundColor: '#D4E4FF',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  fileNameMine: {
    color: '#FFF',
  },
  fileNameTheirs: {
    color: '#000',
  },
  fileMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  fileMetaMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  fileMetaTheirs: {
    color: '#999',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: '#000',
    maxHeight: 120,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E5E5',
  },
  inputBarLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  inputBarLockedText: {
    fontSize: 14,
    color: '#999',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyMessagesText: {
    fontSize: 15,
    color: '#999',
  },
  lockedState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
    marginTop: 4,
  },
  lockedSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  lockedBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#E8F0FE',
  },
  lockedBackText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600' as const,
  },
  settingsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  settingsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  settingsSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    maxHeight: '85%',
  },
  settingsHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 12,
  },
  settingsTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#000',
    textAlign: 'center',
  },
  settingsChatName: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 4,
  },
  settingsScrollView: {
    marginTop: 4,
  },
  settingsScrollContent: {
    paddingBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#000',
  },
  settingDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  settingsDoneButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  settingsDoneText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
  },
});
