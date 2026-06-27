/**
 * Quiz-based Chat Assistant with Real-Time Database Integration
 * Fetches car data, pricing, and vehicle information from the database
 */

(function() {
  'use strict';

  // Quiz Engine Class
  class QuizChatEngine {
    constructor() {
      this.currentNodeId = 'root';
      this.history = [];
      this.userSelections = {}; // Store user selections for filtering
      this.chatMessages = document.getElementById('chatMessages');
      this.chatChoices = document.getElementById('chatChoices');
      this.typingDelay = 500;
      
      this.init();
    }

    init() {
      // Restore from sessionStorage if available
      this.restoreState();
      
      // Render initial node
      this.renderNode(this.currentNodeId);
      
      // Set up event delegation for choice buttons
      this.chatChoices.addEventListener('click', (e) => {
        const button = e.target.closest('.chat-choice-btn');
        if (button && !button.disabled) {
          const choiceId = button.dataset.choiceId;
          const choiceData = button.dataset.choiceData ? JSON.parse(button.dataset.choiceData) : null;
          this.handleChoice(choiceId, choiceData);
        }
      });
    }

    async renderNode(nodeId) {
      this.currentNodeId = nodeId;
      this.saveState();

      // Show typing indicator
      this.showTypingIndicator();

      try {
        let node = await this.getNodeData(nodeId);
        
        // After delay, show agent message and choices
        setTimeout(async () => {
          this.hideTypingIndicator();
          this.addAgentMessage(node.agentText);
          
          if (node.choices && node.choices.length > 0) {
            await this.renderChoices(node.choices);
          }
          
          this.scrollToBottom();
        }, this.typingDelay);
      } catch (error) {
        this.hideTypingIndicator();
        this.addAgentMessage("I'm having trouble accessing our database right now. Please try again or contact us directly.");
        this.renderErrorChoices();
        console.error('Error rendering node:', error);
      }
    }

    async getNodeData(nodeId) {
      // Handle dynamic nodes that require API calls
      switch (nodeId) {
        case 'root':
          return {
            agentText: "Hello! I'm Alex from Rent A Car. How can I help you today?",
            choices: [
              { id: 'rent-car', label: 'Rent a Car', icon: 'fa-car', nextNodeId: 'rent-fuel-type' },
              { id: 'pricing', label: 'Pricing Information', icon: 'fa-dollar-sign', nextNodeId: 'pricing-info' },
              { id: 'vehicle-specs', label: 'Vehicle Specifications', icon: 'fa-cog', nextNodeId: 'specs-fuel-type' },
              { id: 'talk-human', label: 'Talk to a Human', icon: 'fa-user', nextNodeId: 'human-options' }
            ]
          };

        case 'rent-fuel-type':
          const summary = await this.fetchCarsSummary();
          const fuelChoices = summary.fuelTypes.map(ft => ({
            id: `fuel-${ft}`,
            label: ft,
            nextNodeId: 'rent-transmission',
            data: { fuelType: ft }
          }));
          fuelChoices.push({ id: 'back', label: '← Back', nextNodeId: 'root' });
          
          return {
            agentText: 'Great! What fuel type are you interested in?',
            choices: fuelChoices
          };

        case 'rent-transmission':
          const fuelType = this.userSelections.fuelType;
          const carsByFuel = await this.fetchCarsByFilter({ fuelType });
          const transmissions = [...new Set(carsByFuel.map(c => c.transmission).filter(Boolean))].sort();
          
          const transChoices = transmissions.map(t => ({
            id: `trans-${t}`,
            label: t,
            nextNodeId: 'rent-seats',
            data: { transmission: t }
          }));
          transChoices.push({ id: 'back', label: '← Back', nextNodeId: 'rent-fuel-type' });
          
          return {
            agentText: 'Excellent choice! What transmission type do you prefer?',
            choices: transChoices
          };

        case 'rent-seats':
          const { fuelType: fType, transmission: trans } = this.userSelections;
          const carsByTrans = await this.fetchCarsByFilter({ fuelType: fType, transmission: trans });
          const seats = [...new Set(carsByTrans.map(c => c.seats).filter(Boolean))].sort((a, b) => a - b);
          
          const seatChoices = seats.map(s => ({
            id: `seats-${s}`,
            label: `${s} seats`,
            nextNodeId: 'rent-results',
            data: { seatsMin: s, seatsMax: s }
          }));
          seatChoices.push({ id: 'back', label: '← Back', nextNodeId: 'rent-transmission' });
          
          return {
            agentText: 'Perfect! How many seats do you need?',
            choices: seatChoices
          };

        case 'rent-results':
          const { fuelType: finalFuel, transmission: finalTrans, seatsMin, seatsMax } = this.userSelections;
          const matchingCars = await this.fetchCarsByFilter({
            fuelType: finalFuel,
            transmission: finalTrans,
            seatsMin,
            seatsMax
          });
          
          if (matchingCars.length === 0) {
            return {
              agentText: "I couldn't find any cars matching your criteria. Would you like to try different options?",
              choices: [
                { id: 'restart', label: 'Start Over', nextNodeId: 'root' },
                { id: 'back', label: '← Back', nextNodeId: 'rent-seats' }
              ]
            };
          }
          
          const carList = matchingCars.slice(0, 5).map(car => {
            const price = car.priceTier_1_3 || car.price || 0;
            return `• ${car.name} - $${price}/day`;
          }).join('\n');
          
          const moreText = matchingCars.length > 5 ? `\n\n...and ${matchingCars.length - 5} more vehicles available!` : '';
          
          const queryParams = new URLSearchParams({
            fuelType: finalFuel,
            transmission: finalTrans,
            seatsMin: seatsMin || '',
            seatsMax: seatsMax || ''
          });
          
          return {
            agentText: `Here are some matching cars:\n\n${carList}${moreText}\n\nWould you like to view all matching vehicles in our fleet?`,
            choices: [
              {
                id: 'view-fleet',
                label: 'View All Matching Cars',
                icon: 'fa-car',
                action: { type: 'link', url: `/#fleet?${queryParams.toString()}` }
              },
              { id: 'restart', label: 'Start Over', nextNodeId: 'root' }
            ]
          };

        case 'pricing-info':
          const pricingInfo = await this.fetchPricingInfo();
          const summaryForPricing = await this.fetchCarsSummary();
          
          const feeLocations = Object.keys(pricingInfo.deliveryFees).slice(0, 5);
          const feeExamples = feeLocations.map(loc => {
            const fee = pricingInfo.deliveryFees[loc];
            return fee > 0 ? `• ${loc.replace('-', ' ')}: $${fee}` : `• ${loc.replace('-', ' ')}: Free`;
          }).join('\n');
          
          const priceText = `Our cars range from $${summaryForPricing.priceRange.min} to $${summaryForPricing.priceRange.max} per day.\n\n` +
            `Price tiers:\n` +
            `• 1-3 days: $${summaryForPricing.priceTiers.tier1_3.min} - $${summaryForPricing.priceTiers.tier1_3.max}/day\n` +
            `• 7-31 days: $${summaryForPricing.priceTiers.tier7_31.min} - $${summaryForPricing.priceTiers.tier7_31.max}/day\n` +
            `• 31+ days: $${summaryForPricing.priceTiers.tier31_plus.min} - $${summaryForPricing.priceTiers.tier31_plus.max}/day\n\n` +
            `Delivery fees (sample locations):\n${feeExamples}\n\n` +
            `Return fees follow the same structure.`;
          
          return {
            agentText: priceText,
            choices: [
              {
                id: 'view-pricing',
                label: 'See Detailed Pricing',
                icon: 'fa-dollar-sign',
                action: { type: 'link', url: '/#pricing' }
              },
              { id: 'back', label: '← Back', nextNodeId: 'root' },
              { id: 'restart', label: 'Start Over', nextNodeId: 'root' }
            ]
          };

        case 'specs-fuel-type':
          const specsSummary = await this.fetchCarsSummary();
          const specsFuelChoices = specsSummary.fuelTypes.map(ft => ({
            id: `specs-fuel-${ft}`,
            label: ft,
            nextNodeId: 'specs-car-list',
            data: { fuelType: ft }
          }));
          specsFuelChoices.push({ id: 'back', label: '← Back', nextNodeId: 'root' });
          
          return {
            agentText: 'What fuel type would you like to see specifications for?',
            choices: specsFuelChoices
          };

        case 'specs-car-list':
          const specsFuel = this.userSelections.fuelType;
          const specsCars = await this.fetchCarsByFilter({ fuelType: specsFuel });
          
          if (specsCars.length === 0) {
            return {
              agentText: "I couldn't find any cars with that fuel type. Would you like to try a different option?",
              choices: [
                { id: 'back', label: '← Back', nextNodeId: 'specs-fuel-type' },
                { id: 'restart', label: 'Start Over', nextNodeId: 'root' }
              ]
            };
          }
          
          const carChoices = specsCars.slice(0, 10).map(car => ({
            id: `car-${car.id}`,
            label: car.name,
            nextNodeId: 'specs-car-details',
            data: { carId: car.id.toString() }
          }));
          carChoices.push({ id: 'back', label: '← Back', nextNodeId: 'specs-fuel-type' });
          
          return {
            agentText: `Here are our ${specsFuel} vehicles. Select one to see detailed specifications:`,
            choices: carChoices
          };

        case 'specs-car-details':
          const carId = this.userSelections.carId;
          const carDetails = await this.fetchCarDetails(carId);
          
          const specsText = `**${carDetails.name}**\n\n` +
            `• Transmission: ${carDetails.transmission}\n` +
            `• Seats: ${carDetails.seats}\n` +
            `• Fuel Type: ${carDetails.fuelType}\n` +
            `• Pricing:\n` +
            `  - 1-3 days: $${carDetails.priceTier_1_3 || carDetails.price || 'N/A'}/day\n` +
            `  - 7-31 days: $${carDetails.priceTier_7_31 || carDetails.price || 'N/A'}/day\n` +
            `  - 31+ days: $${carDetails.priceTier_31_plus || carDetails.price || 'N/A'}/day`;
          
          return {
            agentText: specsText,
            choices: [
              {
                id: 'view-gallery',
                label: 'View in Gallery',
                icon: 'fa-car',
                action: { type: 'link', url: '/#fleet' }
              },
              { id: 'back', label: '← Back', nextNodeId: 'specs-car-list' },
              { id: 'restart', label: 'Start Over', nextNodeId: 'root' }
            ]
          };

        case 'human-options':
          return {
            agentText: 'I\'d be happy to connect you with a human agent! Choose how you\'d like to reach us:',
            choices: [
              {
                id: 'phone',
                label: 'Call Us',
                icon: 'fa-phone',
                action: { type: 'link', url: '/support/phone' }
              },
              {
                id: 'email',
                label: 'Send Email',
                icon: 'fa-envelope',
                action: { type: 'link', url: '/contacts' }
              },
              {
                id: 'visit',
                label: 'Visit Location',
                icon: 'fa-map-marker-alt',
                action: { type: 'link', url: '/support/visit' }
              },
              { id: 'back', label: '← Back', nextNodeId: 'root' }
            ]
          };

        default:
          return {
            agentText: 'I\'m not sure how to help with that. Let me start over.',
            choices: [
              { id: 'restart', label: 'Start Over', nextNodeId: 'root' }
            ]
          };
      }
    }

    async handleChoice(choiceId, choiceData) {
      // Store user selection if data provided
      if (choiceData) {
        Object.assign(this.userSelections, choiceData);
        this.saveState();
      }

      // Get current node to find the choice
      const currentNode = await this.getNodeData(this.currentNodeId);
      const choice = currentNode.choices?.find(c => c.id === choiceId);
      
      if (!choice) {
        console.error('Choice not found:', choiceId);
        return;
      }

      // Add user message
      const choiceLabel = choice.label || choiceId;
      this.addUserMessage(choiceLabel);
      this.scrollToBottom();

      // Execute action if present
      if (choice.action) {
        if (choice.action.type === 'link') {
          setTimeout(() => {
            window.location.href = choice.action.url;
          }, 300);
        }
        return;
      }

      // Add to history
      this.history.push({
        nodeId: this.currentNodeId,
        choiceId: choiceId
      });
      this.saveState();

      // Transition to next node
      if (choice.nextNodeId) {
        this.renderNode(choice.nextNodeId);
      }
    }

    async renderChoices(choices) {
      // Clear existing choices
      this.chatChoices.innerHTML = '';

      if (!choices || choices.length === 0) {
        return;
      }

      for (const choice of choices) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chat-choice-btn';
        button.dataset.choiceId = choice.id;
        if (choice.data) {
          button.dataset.choiceData = JSON.stringify(choice.data);
        }
        button.setAttribute('aria-label', choice.label);
        
        let content = '';
        if (choice.icon) {
          content = `<i class="fas ${choice.icon}"></i> `;
        }
        content += this.escapeHtml(choice.label);
        
        button.innerHTML = content;
        this.chatChoices.appendChild(button);
      }
    }

    renderErrorChoices() {
      this.chatChoices.innerHTML = '';
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'chat-choice-btn';
      retryBtn.textContent = 'Try Again';
      retryBtn.onclick = () => this.renderNode(this.currentNodeId);
      
      const supportBtn = document.createElement('button');
      supportBtn.type = 'button';
      supportBtn.className = 'chat-choice-btn';
      supportBtn.textContent = 'Contact Support';
      supportBtn.onclick = () => window.location.href = '/contacts';
      
      this.chatChoices.appendChild(retryBtn);
      this.chatChoices.appendChild(supportBtn);
    }

    // API Methods
    async fetchCarsSummary() {
      const response = await fetch('/api/chat/cars-summary');
      if (!response.ok) throw new Error('Failed to fetch cars summary');
      return response.json();
    }

    async fetchCarsByFilter(filters) {
      const params = new URLSearchParams();
      if (filters.fuelType) params.append('fuelType', filters.fuelType);
      if (filters.transmission) params.append('transmission', filters.transmission);
      if (filters.seatsMin) params.append('seatsMin', filters.seatsMin);
      if (filters.seatsMax) params.append('seatsMax', filters.seatsMax);
      
      const response = await fetch(`/api/chat/cars-by-filter?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch filtered cars');
      return response.json();
    }

    async fetchPricingInfo() {
      const response = await fetch('/api/chat/pricing-info');
      if (!response.ok) throw new Error('Failed to fetch pricing info');
      return response.json();
    }

    async fetchCarDetails(carId) {
      const response = await fetch(`/api/chat/car-details/${carId}`);
      if (!response.ok) throw new Error('Failed to fetch car details');
      return response.json();
    }

    // UI Methods
    addUserMessage(text) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message user-message';
      messageDiv.innerHTML = `
        <div class="message-content">
          <p>${this.escapeHtml(text)}</p>
          <span class="message-time">${this.getTimeString()}</span>
        </div>
      `;
      this.chatMessages.appendChild(messageDiv);
    }

    addAgentMessage(text) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message agent-message';
      const formattedText = this.escapeHtml(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      messageDiv.innerHTML = `
        <div class="message-content">
          <p>${formattedText}</p>
          <span class="message-time">${this.getTimeString()}</span>
        </div>
      `;
      this.chatMessages.appendChild(messageDiv);
    }

    showTypingIndicator() {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'message agent-message typing-indicator';
      typingDiv.id = 'typingIndicator';
      typingDiv.innerHTML = `
        <div class="message-content">
          <p><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>
        </div>
      `;
      this.chatMessages.appendChild(typingDiv);
      this.scrollToBottom();
    }

    hideTypingIndicator() {
      const indicator = document.getElementById('typingIndicator');
      if (indicator) {
        indicator.remove();
      }
    }

    scrollToBottom() {
      requestAnimationFrame(() => {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      });
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    getTimeString() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    saveState() {
      try {
        sessionStorage.setItem('quizChatState', JSON.stringify({
          currentNodeId: this.currentNodeId,
          history: this.history,
          userSelections: this.userSelections
        }));
      } catch (e) {
        console.warn('Could not save state to sessionStorage:', e);
      }
    }

    restoreState() {
      try {
        const saved = sessionStorage.getItem('quizChatState');
        if (saved) {
          const state = JSON.parse(saved);
          this.currentNodeId = state.currentNodeId || 'root';
          this.history = state.history || [];
          this.userSelections = state.userSelections || {};
        }
      } catch (e) {
        console.warn('Could not restore state from sessionStorage:', e);
        this.currentNodeId = 'root';
        this.history = [];
        this.userSelections = {};
      }
    }

    restart() {
      this.currentNodeId = 'root';
      this.history = [];
      this.userSelections = {};
      this.chatMessages.innerHTML = '';
      this.chatChoices.innerHTML = '';
      sessionStorage.removeItem('quizChatState');
      this.renderNode('root');
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.quizChat = new QuizChatEngine();
    });
  } else {
    window.quizChat = new QuizChatEngine();
  }

  // Export for global access
  window.QuizChatEngine = QuizChatEngine;
})();
