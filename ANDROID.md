# 안드로이드 앱 빌드·출시 안내 (6.25: 운명의 한반도)

웹 게임을 Capacitor로 감싼 안드로이드 프로젝트가 `android/` 폴더에 있습니다.
**앱 파일(AAB) 빌드는 이 컴퓨터에 Android Studio를 설치한 뒤 직접 하셔야 합니다.**

## 0. 한 번만 준비
1. [Android Studio](https://developer.android.com/studio) 설치 (JDK와 Android SDK가 함께 설치됩니다).
2. 설치 후 처음 열 때 나오는 SDK 설치 안내를 끝까지 진행합니다.

## 1. 웹 변경을 앱에 반영하기
게임 코드를 고칠 때마다 아래 한 줄을 실행합니다.

```bash
npm run android:sync
```

(웹 빌드 후 `android/` 안으로 복사합니다.)

## 2. 내 폰에서 먼저 실행해 보기
1. 폰에서 **개발자 옵션 → USB 디버깅**을 켜고 컴퓨터에 연결합니다.
2. `npm run android:open` 으로 Android Studio를 엽니다.
3. 위쪽 기기 선택에서 내 폰을 고르고 ▶(Run)을 누릅니다.

확인할 것: 세로 고정, 뒤로가기 버튼(창 닫기 → 시트 닫기 → 두 번 눌러 종료), 저장/불러오기, 글자 크기를 "크게"로 바꿨을 때의 화면.

## 3. 출시용 파일(AAB) 만들기
1. Android Studio 메뉴 **Build → Generate Signed App Bundle / APK → Android App Bundle** 선택.
2. **Create new…** 로 앱 서명 키(keystore)를 만듭니다.
   - 이 파일과 비밀번호는 **절대 잃어버리거나 남에게 주지 마세요.** 이 저장소(GitHub)에도 올리면 안 됩니다.
   - 구글 앱 서명(Play App Signing)을 쓰면 키 분실 위험이 줄어듭니다.
3. `release` 로 빌드하면 `android/app/release/app-release.aab` 가 만들어집니다.

업데이트할 때는 `android/app/build.gradle` 의 `versionCode` 를 1씩 올리고(`versionName` 은 보이는 버전), 다시 빌드합니다.

## 4. 앱 이름·패키지명
- 앱 이름: `6.25: 운명의 한반도` (`capacitor.config.ts`, `android/app/src/main/res/values/strings.xml`)
- 패키지명: `com.joon62159.korean625` — **임시 값**입니다. 구글 플레이에 첫 업로드를 하면 바꿀 수 없으니, 원하는 이름이 있으면 그 전에 `capacitor.config.ts` 와 `android/app/build.gradle`(applicationId, namespace)을 바꾸세요.
- 구글 플레이 스토어 표시 이름(30자 이내): `6.25: 운명의 한반도 (Korean War)`

## 5. 구글 플레이 콘솔에서 할 일
1. 개발자 계정 등록(등록비 1회 약 25달러, 신원 확인).
2. 앱 만들기 → 이름, 무료/유료, 게임 선택.
3. **개인정보처리방침 주소** 입력: `PRIVACY_POLICY.md` 초안을 웹에 올려서 주소를 만드세요(GitHub Pages 등).
4. **데이터 보안** 설문: 이 앱은 서버가 없고 저장은 기기 안에서만 합니다. 수집·공유하는 데이터 없음으로 답하되, 실제와 맞는지 출시 전에 다시 확인하세요.
5. **콘텐츠 등급** 설문: 전쟁 배경의 폭력 표현 항목을 정직하게 답합니다.
6. 스토어 등록정보: 소개글, 앱 아이콘 512×512(`assets/icon-only.png` 를 줄여서 사용), 대표 이미지 1024×500, 스크린샷 2장 이상.
7. **테스트 단계**: 개인 계정은 정식 출시 전에 테스터 12명 이상이 14일 이상 참여하는 비공개 테스트가 필요할 수 있습니다. 현재 조건은 Play Console 안내에서 꼭 확인하세요.
8. 프로덕션 출시 신청 → 구글 심사.

## 6. 소개글에 넣을 문구(권장)
"실제 6.25 전쟁을 배경으로 한 가상의 전략 시뮬레이션입니다. 지역 인구·산업·부대 능력치와 일부 사건은 게임을 위한 추정·가상 값이며 실제 통계가 아닙니다."

## 폴더 설명
- `assets/` : 아이콘·시작 화면 원본. 바꾼 뒤 `npx capacitor-assets generate --android` 로 다시 만듭니다.
- `scripts/mkicons.cjs` : 아이콘 원본을 그리는 스크립트.
- `src/native.ts` : 앱 전용 동작(뒤로가기, 상태바, 웹 폰트 제외).
