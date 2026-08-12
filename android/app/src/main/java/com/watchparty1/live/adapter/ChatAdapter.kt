package com.watchparty1.live.adapter

import android.graphics.Color
import android.view.Gravity
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.watchparty1.live.databinding.ItemChatBubbleBinding
import com.watchparty1.live.model.ChatMessage

class ChatAdapter(
    private val messages: MutableList<ChatMessage>,
    private val myNickname: String
) : RecyclerView.Adapter<ChatAdapter.VH>() {

    inner class VH(val b: ItemChatBubbleBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val b = ItemChatBubbleBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(b)
    }

    override fun getItemCount() = messages.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val msg = messages[position]
        val isMe = msg.user == myNickname
        val b = holder.b

        b.tvMessage.text = msg.text
        b.tvTimestamp.text = msg.timestamp

        if (isMe) {
            // My messages: right-aligned, red bubble
            b.bubbleRoot.gravity = Gravity.END
            b.tvSender.visibility = android.view.View.GONE
            b.bubbleContainer.setBackgroundResource(com.watchparty1.live.R.drawable.bg_bubble_me)
        } else {
            // Others: left-aligned, dark bubble, colored name
            b.bubbleRoot.gravity = Gravity.START
            b.tvSender.visibility = android.view.View.VISIBLE
            b.tvSender.text = msg.user
            try {
                b.tvSender.setTextColor(Color.parseColor(msg.color))
            } catch (e: Exception) {
                b.tvSender.setTextColor(Color.parseColor("#38bdf8"))
            }
            b.bubbleContainer.setBackgroundResource(com.watchparty1.live.R.drawable.bg_bubble_other)
        }
    }

    fun addMessage(msg: ChatMessage) {
        messages.add(msg)
        notifyItemInserted(messages.size - 1)
    }

    fun setMessages(list: List<ChatMessage>) {
        messages.clear()
        messages.addAll(list)
        notifyDataSetChanged()
    }

    fun updateNickname(newNickname: String): ChatAdapter {
        return ChatAdapter(messages, newNickname)
    }
}
