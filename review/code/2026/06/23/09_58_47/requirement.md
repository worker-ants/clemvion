# 요구사항(Requirement) Review — 웹채팅 운영 콘솔 Spec

리뷰 대상:
- `spec/7-channel-web-chat/0-architecture.md` (수정)
- `spec/7-channel-web-chat/5-admin-console.md` (신규)
- `spec/7-channel-web-chat/_product-overview.md` (수정)

---

## 발견사항

### **[INFO]** `5-admin-console.md §Overview` 에서 `NAV-WC-01..06` 을 외부 참조하나, 해당 요구사항 ID 는 리뷰 페이로드에 포함되지 않음
- 위치: `5-admin-console.md` line 27 — `요구사항 SoT: [NAV-WC-01..06](../2-navigation/_product-overview.md)`
- 상세: 본 리뷰 페이로드는 3개 파일만 포함했으나, `spec/2-navigation/_product-overview.md §3.14` 및 `spec/2-navigation/_layout.md §2.2` 도 동일 커밋 세트(`edc233db`)에서 함께 변경됐음을 git 실측으로 확인했다. 실제 워크트리에 NAV-WC-01..06 이 등재돼 있고(`_product-overview.md:217-222`), `_layout.md §2.2` 에 Schedule 아래 "Web Chat" 메뉴(순서 5, `/web-chat`, `MessageCircle` 아이콘)가 추가돼 있어 cross-reference 가 충족된다. 페이로드 누락이지 spec 결함은 아님.
- 제안: 정보용. 조치 불필요.

### **[INFO]** `5-admin-console.md §2` 인스턴스 목록 — v1 클라이언트 필터 백로그 언급은 있으나 성능 임계 기준 미정의
- 위치: `5-admin-console.md` §2 비고열 — "서버 `?interactionEnabled=true` 는 데이터 증가 시 도입 검토 — 백로그"
- 상세: 언제 서버 필터로 전환하는지 기준(trigger count 임계 등)이 spec 에 없다. v1 판단으로 충분하며, 즉각적 구현 문제는 아님.
- 제안: 정보용. 성능 기준이 필요해지면 별도 backlog issue 로 추적.

### **[INFO]** `5-admin-console.md §3` 마법사 — 이름 입력 유효성 검증 규칙 미정의
- 위치: `5-admin-console.md §3` "이름 입력" 스텝
- 상세: 이름 필드에 대해 최소 길이, 최대 길이, 중복 허용 여부 등 유효성 규칙이 spec 에 명시되지 않았다. 기존 trigger 생성 규약(`2-trigger-list.md §2.5`)을 따른다고 하지만 해당 spec 에도 이름 검증 규칙이 명시돼 있는지 별도 확인이 필요하다. 구현 시 기존 이름 입력 컴포넌트 규약을 그대로 적용하면 충분하다.
- 제안: 정보용. 구현자가 기존 trigger 이름 유효성 로직을 재사용하면 된다.

### **[INFO]** `5-admin-console.md §4` 외형 빌더 — `localStorage` key naming 미정의
- 위치: `5-admin-console.md §4`
- 상세: localStorage 에 저장한다고 명시했으나 저장 key 이름 규약, 인스턴스 별 격리 방식(예: `webchat-appearance-${triggerId}`), 스토리지 quota 초과 시 처리가 spec 에 없다. 구현 시 결정해야 하는 세부 사항이나 spec 필수 기재 항목은 아님.
- 제안: 정보용. 구현 수준에서 결정 가능.

### **[INFO]** `5-admin-console.md §5` 스니펫 fallback — "동봉 번들 자체가 없을 때" 감지 방법 미정의
- 위치: `5-admin-console.md §5` fallback 항목
- 상세: "동봉 번들 자체가 없을 때만 스니펫/미리보기 UI 를 비활성+경고" 라고 명시했으나, 프론트엔드 런타임에서 어떻게 감지하는지(예: `/_widget/web-chat/v1/` 경로 probe fetch, 빌드 시 env flag 등)가 spec 에 없다. Phase 1 완료 전 증분 1에서는 "미리보기는 disabled" 로 선행 처리됨이 plan 에 명시돼 있어 현 증분에서는 블로커가 아님.
- 제안: 정보용. Phase 1 구현 시 감지 메커니즘을 결정하면 되며, 필요 시 spec §5 에 구현 세부를 추가한다.

### **[WARNING]** `5-admin-console.md §6` 라이브 미리보기 — `postMessage` boot 방식 미정의
- 위치: `5-admin-console.md §6`, 관련: `spec/7-channel-web-chat/2-sdk.md §3 postMessage 프로토콜`
- 상세: 미리보기는 "외형 §4 폼 값을 그대로 반영한다" 고 하는데, 위젯 SPA 가 already-loaded iframe 에 boot config 를 어떻게 전달받는지(초기 iframe src URL query param 으로 주입 vs postMessage `wc:boot` vs) 가 spec 에 정의되지 않았다. `2-sdk.md §3` postMessage 프로토콜이 boot config 주입 경로를 커버하는지 확인 필요. 미리보기가 Phase 3 구현 대상이라 현 증분에선 블로커가 아니지만, Phase 3 착수 전 spec 에 명시돼야 구현 방향이 확정된다.
- 제안: Phase 3 착수 전 `5-admin-console.md §6` 에 boot config 전달 메커니즘(URL param vs postMessage) 을 명시. 또는 `2-sdk.md §3` 프로토콜이 이를 커버한다면 상호 참조 추가.

### **[INFO]** `5-admin-console.md §7` 권한 — 인스턴스 삭제 권한 명시됐으나 삭제 UX(확인 모달 등) 미정의
- 위치: `5-admin-console.md §7` 권한 표
- 상세: "인스턴스 생성·삭제·외형 편집 → editor+" 로 권한이 명시됐으나, 삭제 UI 흐름(확인 모달, cascade 여부 등)이 spec 에 없다. 인스턴스는 webhook trigger 이므로 기존 trigger 삭제 UX 를 따르면 자연스럽고, 기존 규약(`2-trigger-list.md`)이 있으면 상호 참조가 충분하다.
- 제안: 정보용. 구현 시 기존 trigger 삭제 UX 재사용으로 충분.

### **[WARNING]** `0-architecture.md §4` env 표 — "두 값은 일치해야 함" 제약의 검증 주체 미정의
- 위치: `0-architecture.md §4` 표 헤더 — `두 값은 일치해야 함`
- 상세: `NEXT_PUBLIC_WIDGET_CDN_BASE`(admin)와 `WEB_CHAT_WIDGET_ORIGINS`(backend)가 일치해야 한다고 명시했으나, 불일치 시 동작(조용한 CORS 실패 vs 명시적 오류), 배포 시 검증 주체(운영자 수동, CI check, 런타임 경고)가 spec 에 없다. 실제로 동봉(self-origin) 기본값 시나리오에서는 이 두 값을 별도로 설정할 일이 없으므로 이슈가 발생할 상황은 "엣지 CDN override" 때만이지만, 그 경우에 대한 운영 가이드가 부족하다.
- 제안: `0-architecture.md §4` 또는 `4-security.md §2.1` 에 "두 env 불일치 시 위젯 origin 이 CORS 거부됨 — 배포 시 운영자 책임으로 일치 확인" 을 주석으로 추가하는 것을 권장.

### **[INFO]** `_product-overview.md §2` 비목표 명확화 — 선행 비목표 표현과 새 표현의 동의어 가능성
- 위치: `_product-overview.md §2` 변경된 비목표 항목
- 상세: 기존 "위젯 외형의 서버사이드 관리 콘솔" → "위젯 외형의 **백엔드 저장·서빙형** 관리 콘솔" 로 명확화했다. `5-admin-console.md §R2` 에서 근거가 충분히 서술됐고 논리적으로 타당하다. "서버사이드"와 "백엔드 저장·서빙형" 이 동의어일 수 있으나, 후자가 더 구체적이어서 오해 소지가 줄어드는 개선이다.
- 제안: 정보용. 현재 변경이 적절.

---

## 요약

3개 spec 파일의 변경은 의도한 기능(운영자가 제품 내에서 웹채팅 위젯 인스턴스를 만들고, 외형 빌더로 설정하고, 설치 스니펫을 받고, same-origin 동봉 iframe 으로 라이브 미리보기하는 admin 콘솔)을 일관되게 명세하고 있다. 핵심 설계 결정(webhook trigger 재사용, 외형 백엔드 미저장, 위젯 co-deploy 버전잠금, same-origin carve-out)이 세 파일에서 서로 모순 없이 참조된다. NAV-WC-01..06 요구사항 및 `_layout.md` 메뉴 변경은 페이로드에 포함되지 않았으나 git 실측으로 이미 커밋됐음을 확인했다. CRITICAL 발견사항 없음. Phase 3(라이브 미리보기) 착수 전 boot config 전달 메커니즘 명세가 필요하며(WARNING), env 불일치 시 동작 설명도 보강이 권장된다(WARNING). 그 외 항목들은 구현 수준에서 결정 가능한 정보용 사항이다.

## 위험도

LOW
