# 부작용(Side Effect) 리뷰

## 발견사항

### 파일 1: codebase/frontend/next.config.ts

- **[INFO]** `rewrites()` 함수 신규 추가 — 기존 rewrites 없던 상태에서 새 훅 도입
  - 위치: `nextConfig.rewrites()` (라인 54-69 diff 기준)
  - 상세: 이전에는 `rewrites` 설정이 없었으므로 모든 `/_widget/**` 경로에 대해 rewrite 가 적용되지 않았다. 신규 rewrite 가 `/_widget/:segment*/app` → `/_widget/:segment*/app/index.html` 로 매핑하므로, 만약 `public/_widget/.../app` 라는 이름의 실제 파일(index.html 이 아닌)이 있다면 해당 파일 대신 index.html 이 서빙된다. 현재 위젯 번들 구조상 `app` 은 디렉토리이므로 실질 충돌 가능성은 낮지만, 향후 `app` 이름의 정적 파일이 생기면 의도치 않게 index.html 로 redirect 될 수 있다.
  - 제안: 현재 구조에서 문제없으나, 위젯 번들 빌드 산출물 네이밍 컨벤션에 `app` 이름 파일을 직접 두지 않도록 빌드 파이프라인 주석 또는 lint 가드 추가 고려.

- **[INFO]** `rewrites()`는 Next.js 의 `headers()` 보다 먼저 평가됨 — 상호작용 없음
  - 위치: `nextConfig` 객체 전체
  - 상세: `headers()` 는 `no-store, must-revalidate` 를 `/_widget/**` 포함 전 경로에 적용한다. `rewrites()` 는 경로 rewrite 후에도 `headers()` 가 적용되므로, `/_widget/.../app/index.html` 로 rewrite 된 응답도 캐시 금지 헤더를 받는다. 위젯 정적 자산에 캐싱이 필요하다면 `headers()` 의 source 패턴에서 `/_widget/**` 를 제외해야 한다. 현재 커밋 범위에서는 이 변경이 포함되지 않았다.
  - 제안: 위젯 정적 자산(`/_widget/**`)에 대해 `Cache-Control: no-store` 가 의도된 동작인지 확인. 위젯 SPA 는 버전 path(`/v1/`)로 잠기므로 장기 캐시가 적합할 수 있다. 이번 커밋 범위 밖이나 별도 follow-up 으로 검토 권장.

---

### 파일 2: codebase/frontend/src/__tests__/proxy.test.ts

- **[INFO]** 신규 테스트 파일 — 부작용 없음
  - 위치: 파일 전체 (new file)
  - 상세: 순수 단위 테스트 파일. `proxy()` 함수를 import 해 `NextRequest` 를 직접 생성하고 반환값을 검사한다. 전역 상태 수정, 파일시스템 접근, 네트워크 호출, 이벤트 발행 등 부작용 없음. 테스트 헬퍼 함수(`req`, `redirectLocation`)가 모듈 스코프에 정의되어 있으나 export 하지 않아 외부 누출 없음.

---

### 파일 3: codebase/frontend/src/proxy.ts

- **[WARNING]** matcher 와 함수 내 조건 간 이중 레이어 — 불일치 가능성
  - 위치: `config.matcher` (라인 351-353 diff) + `proxy()` 함수 내 `pathname.startsWith("/_widget")` 조건
  - 상세: `matcher` 에 `_widget` 를 제외해 미들웨어 자체가 `/_widget/**` 요청에 대해 실행되지 않도록 했다. 동시에 함수 내부에도 `pathname.startsWith("/_widget")` 조건을 추가했다. 두 레이어가 독립적으로 동작하므로 다른 개발자가 matcher 만 수정하거나 함수 조건만 수정하면 동작이 엇갈릴 수 있다. 현재는 defense-in-depth 로 안전하지만, 미래에 matcher 패턴이 변경될 때 함수 내 조건이 잊혀질 위험이 있다.
  - 제안: 현재 구조는 안전하다. 다만 두 레이어가 의도적 이중 방어임을 주석으로 명시하거나, 함수 내 `/_widget` 조건에 "matcher 가 걸러주나 함수 레벨도 방어" 라는 짧은 인라인 주석을 추가하면 유지보수 안전성이 높아진다.

- **[INFO]** `proxy()` 함수 시그니처 변경 없음 — 호출자 영향 없음
  - 위치: `export function proxy(request: NextRequest)`
  - 상세: 함수 시그니처 자체는 변경되지 않았고 반환 타입도 동일. 기존 호출자(middleware.ts 또는 테스트)에 영향 없음.

- **[INFO]** `publicPaths` 배열 변경 없음 — 인증 보호 경로 집합 유지
  - 위치: 라인 4-11
  - 상세: `/_widget` 는 `publicPaths` 에 추가되지 않고 별도 정적 자산 예외 블록으로 처리됐다. 이는 의도적 설계(정적 자산과 공개 페이지의 개념 분리)이며 부작용 없음.

---

### 파일 4: spec/7-channel-web-chat/0-architecture.md

- **[INFO]** spec 문서 갱신 — 코드 부작용 없음
  - 위치: §4.1 신규 단락 (라인 444-449 diff)
  - 상세: 문서 전용 변경. 런타임 동작·인터페이스·시그니처·전역 상태에 영향 없음. 신규 단락이 기존 §4.1 내용과 동일 의미의 구현 전제를 명문화한 것으로, spec 내부 일관성 유지됨.

---

## 요약

이번 변경은 `/_widget/**` 경로에 대한 인증 미들웨어 예외와 Next.js rewrite 를 추가해 동봉 위젯 SPA 서빙을 복구한다. 전역 변수 도입, 파일시스템 부작용, 외부 네트워크 호출, 이벤트/콜백 변경은 없다. `proxy()` 함수 시그니처가 유지되어 호출자 영향도 없다. 주목할 부분은 두 가지다: (1) `/_widget/**` 에 대해 matcher 레벨과 함수 내부 레벨이 이중으로 예외 처리되어 현재는 안전하나 장기 유지보수 시 불일치 위험이 존재하며, (2) 기존 `headers()` 의 `no-store` 정책이 rewrite 후 위젯 index.html 에도 그대로 적용되어 위젯 정적 자산이 캐시되지 않는다 — 이는 현재 명시적으로 수정되지 않아 의도인지 gap 인지 확인이 필요하다.

## 위험도

LOW
