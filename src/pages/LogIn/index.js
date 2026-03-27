import { useState, useEffect, useRef, useMemo } from "react";
import styles from "./index.module.css";

// --- Helper Components (Optimized: No internal event listeners) ---

const Pupil = ({ size = 12, maxDistance = 5, pupilColor = "#2D2D2D", forceLookX, forceLookY, mouseX, mouseY, parentRef }) => {
  const position = useMemo(() => {
    if (!parentRef?.current) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const rect = parentRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);
    const angle = Math.atan2(deltaY, deltaX);

    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  }, [mouseX, mouseY, forceLookX, forceLookY, maxDistance, parentRef]);

  return (
    <div
      className={styles.pupil}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    />
  );
};

const EyeBall = ({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  isBlinking = false,
  forceLookX,
  forceLookY,
  mouseX,
  mouseY,
  parentRef
}) => {
  return (
    <div
      ref={parentRef}
      className={styles.eyeBall}
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: 'white',
      }}
    >
      {!isBlinking && (
        <Pupil
          size={pupilSize}
          maxDistance={maxDistance}
          forceLookX={forceLookX}
          forceLookY={forceLookY}
          mouseX={mouseX}
          mouseY={mouseY}
          parentRef={parentRef}
        />
      )}
    </div>
  );
};

// --- Main Component ---
function LogIn() {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  
  // Form State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Animation State
  const [isTyping, setIsTyping] = useState(false);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);
  const [mouthShape, setMouthShape] = useState('circle');

  // Refs
  const purpleRef = useRef(null);
  const blackRef = useRef(null);
  const yellowRef = useRef(null);
  const orangeRef = useRef(null);
  const eyePurpleLeftRef = useRef(null);
  const eyePurpleRightRef = useRef(null);
  const eyeBlackLeftRef = useRef(null);
  const eyeBlackRightRef = useRef(null);

  // Global Mouse Listener
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Unified Mouth Shape Logic
  useEffect(() => {
    const updateMouth = () => {
      if (!orangeRef.current) return;
      const rect = orangeRef.current.getBoundingClientRect();
      const isNearOrange = (
        mouseX > rect.left - 50 &&
        mouseX < rect.right + 50 &&
        mouseY > rect.top - 50 &&
        mouseY < rect.bottom + 50
      );

      if (isNearOrange) {
        setMouthShape('circle');
      } else if (showPassword) {
        setMouthShape('foldUp');
      } else if (password.length > 0 && !showPassword) {
        setMouthShape('foldDown');
      } else {
        setMouthShape('circle');
      }
    };
    updateMouth();
  }, [mouseX, mouseY, showPassword, password]);

  // Blinking Logic
  useEffect(() => {
    const createBlinker = (setState) => {
      const schedule = () => {
        const timeout = setTimeout(() => {
          setState(true);
          setTimeout(() => {
            setState(false);
            schedule();
          }, 150);
        }, Math.random() * 4000 + 3000);
        return timeout;
      };
      return schedule();
    };

    const timerPurple = createBlinker(setIsPurpleBlinking);
    const timerBlack = createBlinker(setIsBlackBlinking);

    return () => {
      clearTimeout(timerPurple);
      clearTimeout(timerBlack);
    };
  }, []);

  // Typing Interaction
  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true);
      const timer = setTimeout(() => setIsLookingAtEachOther(false), 800);
      return () => clearTimeout(timer);
    }
    setIsLookingAtEachOther(false);
  }, [isTyping]);

  // Peeking Logic
  useEffect(() => {
    if (password.length > 0 && showPassword) {
      const schedulePeek = () => {
        const timer = setTimeout(() => {
          setIsPurplePeeking(true);
          setTimeout(() => setIsPurplePeeking(false), 800);
        }, Math.random() * 3000 + 2000);
        return timer;
      };
      const timer = schedulePeek();
      return () => clearTimeout(timer);
    }
    setIsPurplePeeking(false);
  }, [password, showPassword]);

  // Position Calculation Helper
  const calculatePosition = (ref) => {
    if (!ref?.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;
    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;

    return {
      faceX: Math.max(-15, Math.min(15, deltaX / 20)),
      faceY: Math.max(-10, Math.min(10, deltaY / 30)),
      bodySkew: Math.max(-6, Math.min(6, -deltaX / 120)),
    };
  };

  const purplePos = calculatePosition(purpleRef);
  const blackPos = calculatePosition(blackRef);
  const yellowPos = calculatePosition(yellowRef);
  const orangePos = calculatePosition(orangeRef);

  const isHidingPassword = password.length > 0 && !showPassword;

  // Handlers
  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    setIsTyping(val.length > 0 || password.length > 0);
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    setIsTyping(val.length > 0 || username.length > 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username && password) setIsLoggedIn(true);
  };

  if (isLoggedIn) {
    return (
      <div className={styles.successContainer}>
        <div className={styles.successMessage}>
          <h2>Welcome, {username}! 🎉</h2>
          <p>Successfully logged in!</p>
          <button onClick={() => setIsLoggedIn(false)} className={styles.logoutButton}>
            Log Out
          </button>
        </div>
      </div>
    );
  }

  // Dynamic Style Calculations
  const getPurpleStyle = () => ({
    height: isTyping || isHidingPassword ? '440px' : '400px',
    transform: (password.length > 0 && showPassword)
      ? `skewX(0deg)`
      : (isTyping || isHidingPassword)
        ? `skewX(${purplePos.bodySkew - 12}deg) translateX(40px)`
        : `skewX(${purplePos.bodySkew}deg)`,
  });

  const getBlackStyle = () => ({
    transform: (password.length > 0 && showPassword)
      ? `skewX(0deg)`
      : isLookingAtEachOther
        ? `skewX(${blackPos.bodySkew * 1.5 + 10}deg) translateX(20px)`
        : (isTyping || isHidingPassword)
          ? `skewX(${blackPos.bodySkew * 1.5}deg)`
          : `skewX(${blackPos.bodySkew}deg)`,
  });

  const getOrangeStyle = () => ({
    transform: (password.length > 0 && showPassword) ? `skewX(0deg)` : `skewX(${orangePos.bodySkew}deg)`,
  });

  const getYellowStyle = () => ({
    transform: (password.length > 0 && showPassword) ? `skewX(0deg)` : `skewX(${yellowPos.bodySkew}deg)`,
  });

  // Force Look Props Helpers
  const purpleForce = (password.length > 0 && showPassword)
    ? { x: isPurplePeeking ? 4 : -4, y: isPurplePeeking ? 5 : -4 }
    : isLookingAtEachOther ? { x: 3, y: 4 } : {};

  const blackForce = (password.length > 0 && showPassword)
    ? { x: -4, y: -4 }
    : isLookingAtEachOther ? { x: 0, y: -4 } : {};

  const othersForce = (password.length > 0 && showPassword) ? { x: -5, y: -4 } : {};

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <div className={styles.charactersContainer}>
          
          {/* Purple Character */}
          <div ref={purpleRef} className={styles.purpleCharacter} style={getPurpleStyle()}>
            <div className={styles.purpleEyes} style={{
              left: (password.length > 0 && showPassword) ? '20px' : isLookingAtEachOther ? '55px' : `${45 + purplePos.faceX}px`,
              top: (password.length > 0 && showPassword) ? '35px' : isLookingAtEachOther ? '65px' : `${40 + purplePos.faceY}px`,
            }}>
              <EyeBall size={18} pupilSize={7} maxDistance={5} isBlinking={isPurpleBlinking} forceLookX={purpleForce.x} forceLookY={purpleForce.y} mouseX={mouseX} mouseY={mouseY} parentRef={eyePurpleLeftRef} />
              <EyeBall size={18} pupilSize={7} maxDistance={5} isBlinking={isPurpleBlinking} forceLookX={purpleForce.x} forceLookY={purpleForce.y} mouseX={mouseX} mouseY={mouseY} parentRef={eyePurpleRightRef} />
            </div>
          </div>

          {/* Black Character */}
          <div ref={blackRef} className={styles.blackCharacter} style={getBlackStyle()}>
            <div className={styles.blackEyes} style={{
              left: (password.length > 0 && showPassword) ? '10px' : isLookingAtEachOther ? '32px' : `${26 + blackPos.faceX}px`,
              top: (password.length > 0 && showPassword) ? '28px' : isLookingAtEachOther ? '12px' : `${32 + blackPos.faceY}px`,
            }}>
              <EyeBall size={16} pupilSize={6} maxDistance={4} isBlinking={isBlackBlinking} forceLookX={blackForce.x} forceLookY={blackForce.y} mouseX={mouseX} mouseY={mouseY} parentRef={eyeBlackLeftRef} />
              <EyeBall size={16} pupilSize={6} maxDistance={4} isBlinking={isBlackBlinking} forceLookX={blackForce.x} forceLookY={blackForce.y} mouseX={mouseX} mouseY={mouseY} parentRef={eyeBlackRightRef} />
            </div>
          </div>

          {/* Orange Character */}
          <div ref={orangeRef} className={styles.orangeCharacter} data-mouth={mouthShape} style={getOrangeStyle()}>
            <div className={styles.orangeEyes} style={{
              left: (password.length > 0 && showPassword) ? '50px' : `${82 + orangePos.faceX}px`,
              top: (password.length > 0 && showPassword) ? '85px' : `${90 + orangePos.faceY}px`,
            }}>
              <Pupil size={12} maxDistance={5} forceLookX={othersForce.x} forceLookY={othersForce.y} mouseX={mouseX} mouseY={mouseY} parentRef={orangeRef} />
              <Pupil size={12} maxDistance={5} forceLookX={othersForce.x} forceLookY={othersForce.y} mouseX={mouseX} mouseY={mouseY} parentRef={orangeRef} />
            </div>
            <div className={styles.orangeMouth} style={{
              left: (password.length > 0 && showPassword) ? '60px' : `${100 + orangePos.faceX}px`,
              top: (password.length > 0 && showPassword) ? '128px' : `${133 + orangePos.faceY}px`,
            }}>
              <div className={styles.mouthContainer}>
                <div className={styles.mouthShape}></div>
              </div>
            </div>
          </div>

          {/* Yellow Character */}
          <div ref={yellowRef} className={styles.yellowCharacter} style={getYellowStyle()}>
            <div className={styles.yellowEyes} style={{
              left: (password.length > 0 && showPassword) ? '20px' : `${52 + yellowPos.faceX}px`,
              top: (password.length > 0 && showPassword) ? '35px' : `${40 + yellowPos.faceY}px`,
            }}>
              <Pupil size={12} maxDistance={5} forceLookX={othersForce.x} forceLookY={othersForce.y} mouseX={mouseX} mouseY={mouseY} parentRef={yellowRef} />
              <Pupil size={12} maxDistance={5} forceLookX={othersForce.x} forceLookY={othersForce.y} mouseX={mouseX} mouseY={mouseY} parentRef={yellowRef} />
            </div>
            <div className={styles.yellowMouth} style={{
              left: (password.length > 0 && showPassword) ? '10px' : `${40 + yellowPos.faceX}px`,
              top: (password.length > 0 && showPassword) ? '88px' : `${88 + yellowPos.faceY}px`,
            }} />
          </div>

        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <h2 className={styles.title}>Welcome Back</h2>
          <div className={styles.inputGroup}>
            <label htmlFor="username" className={styles.label}>Username</label>
            <input
              type="text" id="username" value={username} onChange={handleUsernameChange}
              className={styles.input} placeholder="Enter your username" autoComplete="username"
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? "text" : "password"} id="password" value={password} onChange={handlePasswordChange}
                className={`${styles.input} ${styles.passwordInput}`} placeholder="Enter your password" autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className={styles.togglePassword}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button type="submit" className={styles.submitButton}>Log In</button>
        </form>
      </div>
    </div>
  );
}

// 默认导出组件
export default LogIn;