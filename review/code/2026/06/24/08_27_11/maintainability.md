# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: 웹채팅 운영 콘솔 구현 증분 (spec/7-channel-web-chat/ + 관련 구현 파일)
리뷰 일시: 2026-06-24

---

## 발견사항

### **[INFO]** `use-web-chat.ts` — `WorkflowOption` / `CreatedWebChat` 인터페이스 가시성 불일치
- 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` line 30, line 101
- 상세: `WorkflowOption`(line 30)은 `export` 되어 있으나 파일 외부에서 이를 직접 임포트하는 소비자가 없다. 반면 `CreatedWebChat`(line 101)은 `interface` 선언이지만 `export` 없이 파일 내부에서만 사용된다. 두 인터페이스 모두 공개·비공개 구분이 모호하며, `WorkflowOption` 은 `useWorkflowOptions()` 훅 반환 타입으로만 쓰이므로 `export` 필요성이 낮다. 일관성을 위해 실제 소비 여부에 따라 가시성을 통일하는 것이 권장된다.
- 제안: `WorkflowOption` 은 실제로 외부 소비가 없으면 `export` 제거. `CreatedWebChat` 은 현재 내부 전용이므로 현 상태 유지. 또는 두 인터페이스 모두 `export` 해 타입 재사용성을 높이고 일관성 확보.

---

### **[INFO]** `use-web-chat.ts` — `MAX_LIST_LIMIT = 100` 상수가 두 쿼리에 공유되나 의미가 다름
- 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` line 43
- 상세: `MAX_LIST_LIMIT = 100` 이 `useWebChatInstances`(인스턴스 목록)와 `useWorkflowOptions`(워크플로우 드롭다운 목록) 양쪽에 동일하게 적용된다. 두 리소스의 실제 기대 최대 개수는 다를 수 있으며(인스턴스는 웹채팅 전용, 워크플로우는 전체 목록), 단일 상수를 공유하면 한쪽을 조정할 때 다른 쪽도 영향을 받는다. 현재는 100이 적합하지만 이 의존성은 미래 변경 시 혼란을 줄 수 있다.
- 제안: 필요시 `MAX_WEB_CHAT_LIST_LIMIT` / `MAX_WORKFLOW_OPTIONS_LIMIT` 으로 분리하거나, 상수에 JSDoc 주석으로 "인스턴스·워크플로우 목록 공용" 의도를 명시해 향후 분리 기준을 제공한다.

---

### **[INFO]** `live-preview.tsx` — 매직 넘버 `8000`(타임아웃), `320`/`640`(높이 범위)가 상수화됐으나 파일 상단에 분산
- 위치: `/codebase/frontend/src/components/web-chat/live-preview.tsx` line 17~22
- 상세: `READY_TIMEOUT_MS = 8000`, `PREVIEW_HEIGHT = 320`, `PREVIEW_MAX_HEIGHT = 640` 세 상수가 파일 상단에 적절히 선언되어 있다. 이는 긍정적 패턴이다. 단, spec(`5-admin-console §6`)에 명시된 값(`[320, 640]px`)과 동기화 여부를 코드에서 직접 확인할 수 없으며, 상수에 spec 참조 주석이 없다.
- 제안: `PREVIEW_HEIGHT` / `PREVIEW_MAX_HEIGHT` 상수에 `// spec 5-admin-console §6 clamp range` 주석 한 줄을 추가해 spec 근거를 명시. `READY_TIMEOUT_MS` 에는 "번들 미동봉 감지용" 설명이 있으나 ms 단위 경험적 기준(`8s`)의 근거는 없음 — 상수 주석으로 간단히 보완 가능.

---

### **[INFO]** `live-preview.tsx` — `srcKey` 상태와 렌더 중 `setSrcKey` + `setStatus` 처리의 비표준 패턴
- 위치: `/codebase/frontend/src/components/web-chat/live-preview.tsx` line 61~66
- 상세: iframeSrc 변경 시 status·previewHeight를 리셋하기 위해 렌더 함수 본문 내에서 직접 setState를 호출하는 패턴("previous-render 정보 저장" 방식)을 사용한다. React 공식 문서는 이 패턴을 인정하지만, 경험이 적은 기여자에게는 "렌더 중 setState는 금지"라는 일반 규칙과 상충해 혼란을 줄 수 있다. 파일 상단 주석이 이를 설명하고 있으나 패턴 자체는 비직관적이다.
- 제안: 현 구현은 기능적으로 올바르며 주석으로 설명되어 있다. 유지보수성 차원에서 이 렌더 중 상태 리셋이 필요한 이유(effect 안 setState 회피)를 인라인에 한 줄로 요약하면 충분하다. 현 주석(line 59)이 이미 이 역할을 하므로 현 상태 수용 가능.

---

### **[INFO]** `use-appearance-draft.ts` — `KEY_PREFIX` 상수가 `"clemvion:web-chat:appearance:"` 하드코딩
- 위치: `/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` line 35
- 상세: localStorage 키 prefix가 `"clemvion:web-chat:appearance:"` 로 하드코딩되어 있다. 제품명(`clemvion`)이 변경되거나 키 네임스페이스 정책이 바뀔 경우 이 파일만 수정하면 되어 단일 위치 수정은 양호하다. 그러나 다른 localStorage 사용처(타 모듈)의 prefix 규약과 일관성이 확인되지 않는다. 코드베이스에 별도 localStorage 키 규약이 없다면 이 상수의 출처/패턴을 주석으로 명시하는 것이 좋다.
- 제안: 다른 localStorage 사용처와의 prefix 일관성 확인. 규약이 없으면 `// 앱 전역 localStorage 네임스페이스 규약: <앱명>:<도메인>:<항목>:` 형태 주석 추가.

---

### **[INFO]** `snippet.ts` — `pruneObject` 제네릭이 불필요하게 복잡
- 위치: `/codebase/frontend/src/lib/web-chat/snippet.ts` line 43~46
- 상세: `pruneObject<T extends Record<string, unknown>>(obj: T): T | undefined` 제네릭 선언은 정확하게 타입을 추론하려는 의도이지만, 호출 결과를 바로 `appearance` / `welcome` / `launcher` 에 넣을 때 TypeScript 가 이미 narrow 된 타입을 갖고 있어 제네릭이 실질 이점을 주지 않는다. 단순히 `Record<string, unknown>` 반환으로도 동작한다.
- 제안: 현 패턴은 기능적으로 올바르고 지나치게 복잡한 수준은 아니다. 제네릭을 제거해 `(obj: Record<string, unknown>) => Record<string, unknown> | undefined` 로 단순화하면 가독성이 약간 향상된다. 선택사항.

---

### **[INFO]** `embed-config.service.ts` — JSDoc 주석 블록 순서 이상(주석이 상수 선언 앞에 오지 않음)
- 위치: `/codebase/backend/src/modules/hooks/embed-config.service.ts` line 20~21
- 상세: `INTERACTION_ALLOWED_ORIGINS_KEY` 상수 선언(line 21) 앞에 클래스 JSDoc 블록(line 9~19)이 있어야 할 위치에 상수 선언 설명 주석(line 20)이 삽입되어 있다. 클래스 JSDoc과 클래스 선언 사이에 상수가 끼어들어 있어 파일 스캔 시 클래스 선언이 바로 보이지 않는다.
- 제안: `INTERACTION_ALLOWED_ORIGINS_KEY` 상수를 클래스 내부(static readonly)로 이동하거나, 클래스 JSDoc 직전으로 상수를 올려 클래스 선언이 JSDoc 바로 아래에 오도록 정렬. 기능 영향 없음.

---

### **[WARNING]** `use-web-chat.ts` — `InteractionTokenStrategy` 유니언에 `per_trigger` 포함 — 콘솔 내부에서 사용 금지된 값
- 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts` line 25, line 135; `/codebase/backend/src/modules/triggers/dto/interaction-config.dto.ts` line 18
- 상세: `InteractionTokenStrategy = 'per_execution' | 'per_trigger'` 유니언 타입이 프론트엔드 타입 정의(`@/lib/types/trigger`)와 백엔드 DTO 양쪽에 존재한다. spec(`3-auth-session §2·§R3`)은 `per_trigger`(영구 `itk_*` 토큰)를 웹채팅 콘솔에서 **명시적으로 배제**했다. 코드에서도 `useCreateWebChat`은 `per_execution`만 하드코딩하고, `useUpdateWebChatAppearance`도 `tokenStrategy ?? "per_execution"` 폴백으로 `per_trigger`가 실제 경로에 진입하지 않도록 방어한다. 그러나 타입 유니언에 `per_trigger`가 남아 있어 향후 기여자가 실수로 `per_trigger`를 넘기는 API를 추가할 수 있다.
- 제안: 프론트엔드 `WebChatInstance.tokenStrategy` 필드 주석(line 25)에 이미 "외형 저장(PATCH) 시 interaction 객체 전체를 보존해 보내야 한다"는 내용이 있으나, `per_trigger` 가 기각된 옵션임을 명시하는 주석이 없다. `InteractionTokenStrategy` 타입 정의 근처에 `// 웹채팅 콘솔은 per_execution 만 사용. per_trigger 는 spec 3-auth-session §R3 에서 배제` 주석을 추가하거나, 웹채팅 콘솔 전용 타입 별칭 `type WebChatTokenStrategy = 'per_execution'` 을 도입해 오용 가능성을 차단한다.

---

### **[WARNING]** `web-chat-appearance.dto.ts` — `suggestions` 필드 형태(flat string)가 `WebChatBootInput.welcome.suggestions`(string[])와 다르며 변환 책임이 클라이언트에만 있음
- 위치: `/codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts` line 58~64; `/codebase/frontend/src/components/web-chat/snippet-input.ts` line 6
- 상세: 서버 DTO `WebChatAppearanceDto.suggestions`는 "줄바꿈으로 구분된 추천 질문" flat string으로 저장된다. 위젯 `BootConfig`(`welcome.suggestions`)는 `string[]` 배열을 기대한다. 이 형태 변환(`split("\n")`)은 프론트엔드 `draftToBootInput` 의 `splitSuggestions` 에서만 수행되며, 서버측 DTO에는 이 변환 책임이 명시되어 있지 않다. 향후 다른 클라이언트(예: 백엔드에서 스니펫을 직접 생성하는 시나리오)가 생기면 동일 변환을 재구현해야 한다.
- 제안: `WebChatAppearanceDto.suggestions` 필드 JSDoc에 "클라이언트에서 `\n` 으로 분리해 `string[]` 로 변환 후 BootConfig 에 주입한다(SoT: `snippet-input.ts` `splitSuggestions`)" 를 명시해 변환 책임과 위치를 단일 진실로 추적한다. 또는 향후 BootConfig 직접 생성 경로가 생기면 서버측에 변환 유틸리티를 제공하는 것을 고려.

---

### **[INFO]** `page.tsx` — `WebChatDetail` 내부 함수 `save()`가 `async` + `void` 래핑으로 호출
- 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` line 122~134, line 148
- 상세: `save()` 는 `async function` 이지만 버튼 `onClick`에서 `() => void save()` 로 호출된다. 이는 Promise 경고(float promise)를 피하기 위한 표준 패턴이며 기능적으로 올바르다. 단, `catch` 블록이 비어(`catch {}`) 있고 toast로 에러를 표시하는데, `catch` 블록에서 error 파라미터를 받지 않아 에러 내용이 로그에도 남지 않는다.
- 제안: `} catch {` 를 `} catch (err) { console.error('[WebChatDetail.save]', err); toast.error(...) }` 로 교체해 운영 디버깅을 용이하게 한다. 현재 코드베이스 내 유사 패턴(다른 save 핸들러)이 동일하게 처리된다면 일관성 유지 차원에서 현 상태도 수용 가능.

---

### **[INFO]** 리뷰 산출물(review/consistency/) JSON 파일 — `\ No newline at end of file`
- 위치: `review/consistency/2026/06/23/10_27_50/meta.json`, `review/consistency/2026/06/23/13_38_25/_retry_state.json`, `review/consistency/2026/06/23/13_38_25/meta.json`, `review/consistency/2026/06/24/02_34_35/_retry_state.json`, `review/consistency/2026/06/24/02_34_35/meta.json`
- 상세: 위 JSON 파일들이 모두 파일 끝 개행 없이 저장되어 있다(`\ No newline at end of file`). 이는 유닉스 관례 위반이며, `cat` / `diff` 등 도구에서 "no newline at end of file" 경고가 발생한다. 동일 리뷰 세션에서 생성된 `.md` 산출물들에는 이 문제가 없다.
- 제안: 산출물 생성 도구(orchestrator)가 JSON 파일 작성 시 끝에 `\n` 을 추가하도록 수정한다. 기존 파일들은 다음 수정 기회에 개행을 추가하면 충분하다.

---

## 요약

이번 변경의 유지보수성은 전반적으로 양호하다. 컴포넌트·훅·유틸리티가 단일 책임에 가깝게 분리되어 있고, 상수화·JSDoc·spec 참조 주석이 핵심 경로에 잘 적용되어 있다. `use-appearance-draft.ts` 의 서버 SoT / localStorage 캐시 분리 설계와 `live-preview.tsx` 의 postMessage 프로토콜 구현은 의도가 명확하게 드러나는 코드다. 주요 유지보수 위험은 두 가지다: (1) `InteractionTokenStrategy` 유니언에 spec 상 배제된 `per_trigger` 가 잔류해 향후 오용 가능성이 있고, (2) `suggestions` 필드의 flat string ↔ string[] 변환 책임이 클라이언트에만 묵시적으로 위임되어 문서화되지 않은 계약이 된다. 나머지는 가시성 통일, 상수 주석 보강, JSON 파일 끝 개행 등 경미한 일관성 사항이다.

---

## 위험도

LOW
