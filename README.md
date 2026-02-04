# 이코네Zip (IkkoNezip)

맥에서 만든 파일의 **한글 파일명 깨짐 문제**를 해결하고 압축하는 웹 애플리케이션입니다.

## 문제점

macOS는 파일명을 NFD(Normalization Form Decomposed) 형식으로 저장합니다:
- `"한글"` → `"ㅎㅏㄴㄱㅡㄹ"` (자모 분리)

Windows에서 이 파일을 열면 파일명이 깨져 보입니다.

## 해결책

이 앱은 파일명을 NFC(Normalization Form Composed) 형식으로 변환합니다:
- `"ㅎㅏㄴㄱㅡㄹ"` → `"한글"` (정상 표시)

## 주요 기능

- **NFD → NFC 변환**: 한글 파일명 자동 정규화
- **100% 브라우저 처리**: 서버 업로드 없음, 개인정보 보호
- **폴더 구조 유지**: 하위 폴더 구조 그대로 압축
- **AES-256 암호화**: Windows 호환 암호 ZIP 생성
- **오프라인 지원**: 인터넷 없이도 사용 가능
- **광고 없음**: 깔끔한 사용자 경험
- **자동 파일 제외**: `.DS_Store`, `Thumbs.db` 등 시스템 파일 자동 제거
- **날짜 prefix**: 다운로드 파일명에 `YYMMDD_` 자동 추가

## 기술 스택

- **Frontend**: React 19 + TypeScript + Vite
- **스타일링**: Tailwind CSS v4
- **UI 컴포넌트**: shadcn/ui (Radix UI)
- **압축**: [@zip.js/zip.js](https://github.com/gildas-lormeau/zip.js) (AES 암호화 지원)
- **배포**: Docker + Nginx

## 시작하기

### 개발 서버

```bash
npm install
npm run dev
```

http://localhost:5173 에서 확인

### 프로덕션 빌드

```bash
npm run build
npm run preview
```

### Docker 배포

```bash
docker-compose up --build
```

http://localhost:3000 에서 확인

## 환경 변수

`.env` 파일을 생성하여 서비스명을 설정할 수 있습니다:

```env
VITE_APP_NAME=이코네Zip
```

설정하지 않으면 기본값 `맥윈집`이 사용됩니다.

## 사용법

1. 파일 또는 폴더를 드래그 앤 드롭하거나 클릭하여 선택
2. (선택) ZIP 파일명 수정
3. (선택) 암호 설정
4. "ZIP 다운로드" 버튼 클릭

## 라이선스

Copyright (c) 2024 1kko. All rights reserved.
