import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp,
  collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- Firebase 設定 (這部分和 import 保持在最外層) ---
const firebaseConfig = {
    apiKey: "AIzaSyBkJEjFkCeDp9WxsOG9iTkUhX5JmdzxMsY",
    authDomain: "html-114.firebaseapp.com",
    databaseURL: "https://html-114-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "html-114",
    storageBucket: "html-114.firebasestorage.app",
    messagingSenderId: "819917862821",
    appId: "1:819917862821:web:14f5167ef0229697e25a4c"
  };

// --- 初始化 Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ▼▼▼ 使用 DOMContentLoaded 來確保 HTML 完全載入後才執行 JS ▼▼▼
document.addEventListener('DOMContentLoaded', () => {

  // --- DOM 參照 (移到內部) ---
  const authSection = document.getElementById("auth-section");
  const adminSection = document.getElementById("admin-section");
  const memberSection = document.getElementById("member-section");
  const userInfoDiv = document.getElementById("user-info");
  const userEmailSpan = document.getElementById("user-email");
  const logoutButton = document.getElementById("logout-button");

  // 管理員介面 DOM
  const addBookForm = document.getElementById("add-book-form");
  const adminBookListDiv = document.getElementById("admin-book-list");

  // 會員介面 DOM
  const bookListContainer = document.getElementById("book-list-container");
  const rentalListContainer = document.getElementById("rental-list-container");

  // 彈出視窗 DOM
  const borrowModal = document.getElementById('borrow-modal');
  const modalBookTitle = document.getElementById('modal-book-title');
  const closeModalButton = document.querySelector('.close-button');
  const confirmBorrowBtn = document.getElementById('confirm-borrow-btn');
  const durationBtns = document.querySelectorAll('.duration-btn');
  const customDaysInput = document.getElementById('custom-days');
  const modalPriceSpan = document.getElementById('modal-price');
  const modalReturnDateSpan = document.getElementById('modal-return-date');

  let currentBookIdToBorrow = null;
  let currentBorrowDuration = 1;

  // 登入/註冊表單切換的相關參照
  const showLoginToggle = document.getElementById('show-login-toggle');
  const showRegisterToggle = document.getElementById('show-register-toggle');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  // 切換到註冊表單
  showRegisterToggle.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    showRegisterToggle.classList.add('active');
    showLoginToggle.classList.remove('active');
  });

  // 切換到登入表單
  showLoginToggle.addEventListener('click', () => {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    showLoginToggle.classList.add('active');
    showRegisterToggle.classList.remove('active');
  });
  // #region --- 核心渲染邏輯 ---

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      authSection.style.display = "none";
      userInfoDiv.style.display = "flex";
      userEmailSpan.textContent = user.email;
      const adminDoc = await getDoc(doc(db, "admins", user.uid));
      if (adminDoc.exists()) {
        showAdminUI(user);
      } else {
        showMemberUI(user);
      }
    } else {
      authSection.style.display = "block";
      adminSection.style.display = "none";
      memberSection.style.display = "none";
      userInfoDiv.style.display = "none";
    }
  });

  function showAdminUI(user) {
    adminSection.style.display = "block";
    memberSection.style.display = "none";
    renderAdminBookList();
  }

  function showMemberUI(user) {
    memberSection.style.display = "block";
    adminSection.style.display = "none";
    renderMemberBookList();
    renderMemberRentalList(user.uid);
  }

  // #endregion

  // #region --- 管理員功能 ---

  async function renderAdminBookList() {
    const booksCollection = collection(db, "books");
    const booksSnapshot = await getDocs(query(booksCollection));
    adminBookListDiv.innerHTML = '';
    booksSnapshot.forEach(bookDoc => {
      const bookData = bookDoc.data();
      const isBorrowed = bookData.borrowerId != null;
      const bookCard = document.createElement('div');
      bookCard.className = 'book-item';
      bookCard.innerHTML = `
        <h4>${bookData.title}</h4>
        <p>
          狀態：${isBorrowed ? `<strong style="color:red;">已借出</strong>` : `<strong style="color:green;">在館</strong>`}<br>
          ${isBorrowed && bookData.borrowerId ? `借閱者ID: ${bookData.borrowerId.substring(0, 8)}...` : ''}
        </p>
        <div class="actions">
          <button class="edit-btn" data-id="${bookDoc.id}">編輯</button>
          <button class="delete-btn" data-id="${bookDoc.id}">刪除</button>
        </div>
      `;
      adminBookListDiv.appendChild(bookCard);
    });
  }

  addBookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('add-book-title');
      const newTitle = titleInput.value;
      try {
          await addDoc(collection(db, "books"), {
              title: newTitle,
              addedDate: serverTimestamp(),
              borrowDate: null,
              returnDate: null,
              borrowerId: null
          });
          titleInput.value = '';
          renderAdminBookList();
      } catch (error) {
          console.error("新增書籍失敗:", error);
      }
  });

  adminBookListDiv.addEventListener('click', async (e) => {
      const bookId = e.target.dataset.id;
      if (!bookId) return;
      if (e.target.classList.contains('edit-btn')) {
          const newTitle = prompt("請輸入新的書名：");
          if (newTitle) {
              await updateDoc(doc(db, "books", bookId), { title: newTitle });
              renderAdminBookList();
          }
      }
      if (e.target.classList.contains('delete-btn')) {
          if (confirm("確定要刪除這本書嗎？")) {
              await deleteDoc(doc(db, "books", bookId));
              renderAdminBookList();
          }
      }
  });

  // #endregion

  // #region --- 會員功能 ---

  async function renderMemberBookList() {
      const q = query(collection(db, "books"), where("borrowerId", "==", null));
      const booksSnapshot = await getDocs(q);
      bookListContainer.innerHTML = '';
      booksSnapshot.forEach(bookDoc => {
          const bookData = bookDoc.data();
          const bookCard = document.createElement('div');
          bookCard.className = 'book-item';
          bookCard.innerHTML = `
              <h4>${bookData.title}</h4>
              <p>添加日期：${bookData.addedDate ? bookData.addedDate.toDate().toLocaleDateString() : 'N/A'}</p>
              <div class="actions">
                  <button class="borrow-btn" data-id="${bookDoc.id}" data-title="${bookData.title}">租借</button>
              </div>
          `;
          bookListContainer.appendChild(bookCard);
      });
  }

  async function renderMemberRentalList(uid) {
      const q = query(collection(db, "books"), where("borrowerId", "==", uid));
      const booksSnapshot = await getDocs(q);
      rentalListContainer.innerHTML = '';
      if (booksSnapshot.empty) {
          rentalListContainer.innerHTML = '<p>您目前沒有租借任何書籍。</p>';
          return;
      }
      booksSnapshot.forEach(bookDoc => {
          const bookData = bookDoc.data();
          const returnDate = bookData.returnDate.toDate();
          const isOverdue = new Date() > returnDate;
          const bookCard = document.createElement('div');
          bookCard.className = 'book-item';
          bookCard.innerHTML = `
              <h4>${bookData.title}</h4>
              <p>
                  借閱日期: ${bookData.borrowDate.toDate().toLocaleDateString()}<br>
                  預計歸還: ${returnDate.toLocaleDateString()}<br>
                  <strong style="color:${isOverdue ? 'red' : 'inherit'};">${isOverdue ? '已逾期！' : '正常'}</strong>
              </p>
              <div class="actions">
                  <button class="return-btn" data-id="${bookDoc.id}">歸還</button>
              </div>
          `;
          rentalListContainer.appendChild(bookCard);
      });
  }

  

  function updateModalPriceAndDate(days) {
      currentBorrowDuration = days;
      let price = 0;
      if (days === 7) {
          price = 50;
      } else if (days === 30) {
          price = 150;
      } else {
          price = days * 10;
      }
      modalPriceSpan.textContent = `NT$${price}`;
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() + days);
      modalReturnDateSpan.textContent = returnDate.toLocaleDateString();
  }

  durationBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          const days = parseInt(btn.dataset.days);
          customDaysInput.value = days > 6 ? 1 : days;
          updateModalPriceAndDate(days);
      });
  });

  customDaysInput.addEventListener('input', () => {
      let days = parseInt(customDaysInput.value) || 1;
      if (days > 6) {
          days = 6;
          customDaysInput.value = 6;
      }
      updateModalPriceAndDate(days);
  });

  confirmBorrowBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user || !currentBookIdToBorrow) return;
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() + currentBorrowDuration);
      try {
          const bookRef = doc(db, "books", currentBookIdToBorrow);
          await updateDoc(bookRef, {
              borrowerId: user.uid,
              borrowDate: serverTimestamp(),
              returnDate: Timestamp.fromDate(returnDate)
          });
          alert("租借成功！");
          borrowModal.style.display = 'none';
          renderMemberBookList();
          renderMemberRentalList(user.uid);
      } catch (error) {
          console.error("租借失敗:", error);
          alert("租借失敗，請稍後再試。");
      }
  });

  closeModalButton.addEventListener('click', () => {
      borrowModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
      if (e.target == borrowModal) {
          borrowModal.style.display = 'none';
      }
  });

  bookListContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('borrow-btn')) {
        currentBookIdToBorrow = e.target.dataset.id;
        modalBookTitle.textContent = `租借《${e.target.dataset.title}》`;
        updateModalPriceAndDate(1);
        borrowModal.style.display = 'flex';
    }
});

  rentalListContainer.addEventListener('click', async (e) => {
      if (e.target.classList.contains('return-btn')) {
          const bookId = e.target.dataset.id;
          const bookRef = doc(db, "books", bookId);
          const user = auth.currentUser;
          try {
              const bookDoc = await getDoc(bookRef);
              const bookData = bookDoc.data();
              const expectedReturnDate = bookData.returnDate.toDate();
              const today = new Date();
              if (today > expectedReturnDate) {
                  const overdueDays = Math.ceil((today - expectedReturnDate) / (1000 * 60 * 60 * 24));
                  const fine = overdueDays * 20;
                  alert(`書籍已逾期 ${overdueDays} 天，需繳納罰金 NT$${fine} 元。\n(此為提示，系統將直接為您歸還)`);
              } else {
                  alert("感謝您準時歸還！");
              }
              await updateDoc(bookRef, {
                  borrowerId: null,
                  borrowDate: null,
                  returnDate: null
              });
              renderMemberBookList();
              renderMemberRentalList(user.uid);
          } catch (error) {
              console.error("歸還失敗:", error);
              alert("歸還失敗，請稍後再試。");
          }
      }
  });

  // #endregion

  // ▼▼▼ 註冊/登入/登出功能 (現在也安全地在 DOMContentLoaded 內) ▼▼▼

  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, "members", user.uid), {
        memberName: name,
        email: email,
        lastLogin: serverTimestamp()
      });
      alert("✅ 註冊成功，請登入。");
      e.target.reset();
    } catch (err) {
      console.error("註冊失敗:", err.message);
      alert("❌ 註冊失敗：" + err.code);
    }
  });

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("登入失敗:", err.message);
      alert("❌ 登入失敗：帳號或密碼錯誤。");
    }
  });

  logoutButton.addEventListener("click", async () => {
      try {
          await signOut(auth);
      } catch (err) {
          console.error("登出失敗:", err);
          alert("登出時發生錯誤");
      }
  });

}); // ▲▲▲ DOMContentLoaded 事件監聽器結束 ▲▲▲