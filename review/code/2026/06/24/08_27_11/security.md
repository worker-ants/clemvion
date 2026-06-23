# 보안(Security) 코드 리뷰

리뷰 대상: web-chat 운영 콘솔 증분 2 — spec 변경(파일 21~31) + consistency review 산출물(파일 1~20)

---

## 발견사항

### **[WARNING]** `allow-same-origin` sandbox 속성 — same-origin 위젯 임베드의 sandbox 탈출 트레이드오프

- **위치**: `spec/7-channel-web-chat/4-security.md` § iframe sandbox 행 (변경된 코드 라인)
- **상세**: spec 이 명시적으로 "동봉 위젯은 제품과 동일 릴리스로 배포되어 공급망 무결성이 보장되므로 허용한다"라고 기술했지만, `allow-same-origin` 을 admin 콘솔 미리보기 iframe 에 포함하면 **해당 iframe 안에서 악성 스크립트가 실행될 경우 sandbox 탈출이 가능**하다. 구체적으로, `allow-scripts` + `allow-same-origin` 조합은 iframed 문서가 부모 DOM 에 접근하거나 쿠키/localStorage 를 읽는 것을 iframe sandbox 로 막지 못한다. 공급망 무결성 보장(동일 릴리스)은 위젯 SPA 소스 자체의 무결성을 전제하며, 위젯 코드에 XSS가 있거나 의존성(npm)이 침해된 경우 admin 콘솔 세션 전체가 노출된다.
- **제안**:
  1. 미리보기 iframe 에 `allow-scripts allow-forms` 만 두고 `allow-same-origin` 을 제거하는 방안을 검토한다. 이 경우 위젯의 `localStorage`·쿠키 의존 기능(세션 복원, boot config persist)이 동작하지 않으므로, 미리보기 전용 모드에서 이 기능들을 opt-out 할 수 있는지 먼저 확인.
  2. 불가피하게 `allow-same-origin` 을 유지해야 한다면, 현재 spec 에 기재된 트레이드오프 내용(`4-security.md`)을 **운영 보안 가이드**에도 반영하고, 외부 CDN override(`NEXT_PUBLIC_WIDGET_CDN_BASE`) 사용 시 cross-origin 이므로 이 속성 없이도 동작한다는 점을 배포 문서에 명시한다.
  3. Subresource Integrity(SRI)나 Content Security Policy를 admin frontend 에 적용해 위젯 JS 자산 무결성 2차 검증 레이어를 추가한다.

---

### **[WARNING]** `endpointPath` — 클라이언트 UUID 생성, 서버 측 중복/충돌 검증 누락 가능성

- **위치**: `spec/7-channel-web-chat/5-admin-console.md §3` — "콘솔이 `endpointPath` 를 `crypto.randomUUID()` 로 생성하고 `POST /api/triggers` 로 … 만든다"
- **상세**: `endpointPath` 를 클라이언트에서 생성해 서버로 전송하는 구조다. spec 이 `crypto.randomUUID()` 를 사용한다고 명시하나, 서버 측에서 이 값의 형식(UUID 형식 준수 여부)과 중복 여부를 검증하는지 spec 에 명시되지 않았다. 악의적 클라이언트가 임의 문자열(경로 탐색 시도: `../admin`, URL-encoded 특수문자 등)을 `endpointPath` 로 제출하거나, 기존 인스턴스의 `endpointPath` 를 재사용해 인스턴스를 가로채는 시도가 가능하다. 서버가 webhook path 를 URL 구성에 직접 사용(`/api/hooks/:endpointPath`)하는 구조이므로 경로 주입 위험이 있다.
- **제안**:
  1. 백엔드 `POST /api/triggers` 수신 시 `endpointPath` 가 UUID 형식(RFC 4122)인지 regex 검증 적용(이미 구현됐다면 spec 에 명시).
  2. `endpointPath` 유일성 제약(DB unique index)이 있는지 확인하고, 중복 시 409 Conflict 응답으로 명확히 처리.
  3. 서버가 클라이언트 생성 값을 무시하고 서버가 직접 UUID 를 생성하는 방안을 검토 — 클라이언트 생성 값 신뢰를 제거하는 것이 가장 확실하다.

---

### **[WARNING]** `embed-config` 엔드포인트 — 공개·무인증, 응답 캐시 정책 보안 검토 필요

- **위치**: `spec/7-channel-web-chat/4-security.md §3-①` — "`/embed-config` 엔드포인트 동작(공개·무인증): … `Cache-Control: public, max-age=300`"
- **상세**: `GET /api/hooks/:endpointPath/embed-config` 가 완전 공개·무인증이고 `public` 캐시 설정(CDN/프록시 캐싱 허용)이다. allowlist 변경 후 최대 5분 지연이 명시되어 있는데, allowlist 를 **제거하거나 좁히는 보안 업데이트**(특정 도메인이 침해되거나 악용 발견 시)도 5분 지연이 발생한다. 이 기간 동안 이미 캐시된 allowlist 로 차단 목적 도메인이 계속 위젯을 임베드할 수 있다. 또한 `public` 캐시가 중간 CDN/프록시에 allowlist 를 저장하므로, 캐시 포이즈닝 공격 면이 생긴다.
- **제안**:
  1. 응답에 `Cache-Control: private, max-age=300` 또는 `no-store` 적용을 검토해 중간 캐시를 제거한다. allowlist 는 클라이언트(브라우저)의 짧은 캐시는 허용해도 CDN 공유 캐시는 위험하다.
  2. allowlist 를 **축소/제거하는 즉시 무효화** 경로가 있는지(캐시 purge API, 짧은 TTL) 검토.
  3. 비존재 endpointPath 에 대해 항상 `{ allowlist: [], enforce: false }` 를 200으로 반환하는 설계는 열거(enumeration) 방지 관점은 좋으나, **fail-open** 이 기본이므로 enforce 설정 누락 시 허가 없는 도메인도 통과한다는 사실을 운영 문서에 명확히 경고해야 한다.

---

### **[WARNING]** `appearance` 데이터 서버 저장 — PATCH 통째 교체(silent deletion) 위험

- **위치**: `spec/5-system/14-external-interaction-api.md` — "interaction 객체는 PATCH 시 통째로 교체된다(merge 아님). `appearance` 없이 PATCH 하면 기존 저장된 `appearance` 가 조용히 소실(silent deletion)된다"
- **상세**: 기존 `/api/triggers/:id` PATCH 를 `appearance` 없이 호출(예: 다른 필드 업데이트 목적)하면 외형 데이터가 소실된다. 이는 보안 취약점이라기보다 데이터 무결성 위험이지만, 보안 관점에서 공격자가 정당한 편집 권한(`editor+`)을 갖고 `appearance` 를 의도적으로 누락한 PATCH 로 다른 운영자가 저장한 외형 설정을 조용히 삭제할 수 있다. 또한 외부 API 문서를 보고 연동하는 개발자가 실수로 데이터를 소실시키는 경로가 열려 있다.
- **제안**:
  1. 서버 측에서 `PATCH` 시 `interaction` 객체를 merge(shallow merge) 처리하도록 `mergeExternalConfig` 로직을 수정하거나, `appearance` 키가 없을 때는 기존 값을 보존하는 옵션을 도입한다.
  2. 불가능하다면 spec 에 명시된 경고를 API 응답 헤더(`X-Deprecation-Notice`) 또는 Swagger 문서 `@ApiOperation` 에도 반영한다.
  3. 감사 로그(audit log)에 `appearance` 소실 이벤트를 기록해 사후 추적을 가능하게 한다.

---

### **[INFO]** `postMessage` origin 검증 — same-origin 동봉에서의 첫 boot origin 핀 메커니즘

- **위치**: `spec/7-channel-web-chat/2-sdk.md` — "첫 `wc:boot` 의 origin 만 host 로 핀되므로(이후 동일 origin 만 수용) 재전송도 같은 origin 이어야 한다"
- **상세**: 동봉(same-origin) 구조에서 host(콘솔)와 iframe(위젯) origin 이 동일하다. postMessage 의 `event.origin` 검증이 same-origin 에서는 origin 자체가 같으므로 외부 공격자의 postMessage 주입을 방어하는 효과가 있다. 그러나 same-origin 이면 `window.parent` 직접 접근도 가능하므로, postMessage 프로토콜이 아닌 경로로 위젯 iframe 이 콘솔 상태를 수정할 수 있는 가능성이 있다. 설계적으로 "1st-party 위젯이므로 신뢰"한다는 전제는 공급망 위험에 취약하다.
- **제안**: 위젯 iframe 에서 `window.parent.postMessage` 이외의 DOM 접근이 발생하지 않도록 위젯 코드 리뷰를 주기적으로 수행. 외부 CDN override 환경(`NEXT_PUBLIC_WIDGET_CDN_BASE`)에서는 cross-origin 이 되어 이 리스크가 해소됨을 운영 가이드에 명시.

---

### **[INFO]** `WebChatAppearanceDto` 입력 검증 — 다층 화이트리스트 주장에 대한 서버 검증 범위 확인 필요

- **위치**: `spec/7-channel-web-chat/5-admin-console.md §4` — "프런트(`sanitizeDraft`)와 서버(`WebChatAppearanceDto` 의 enum/hex/길이 검증) 양쪽에서 화이트리스트한다(다층 방어)"
- **상세**: spec 이 다층 방어를 언급하나 `WebChatAppearanceDto` 의 구체적 검증 범위(필드별 최대 길이, enum 허용값 목록)가 spec 에 명시되지 않아 구현 표류가 발견되기 어렵다. 특히 `headerTitle`, `welcomeText`, `suggestions`, `disclaimer` 같은 자유 텍스트 필드가 서버에서 최대 길이 초과 입력에 대한 truncation/reject 처리가 되는지, HTML 특수문자가 저장되어 스니펫 생성 시 XSS 벡터가 되는지 검토가 필요하다. 스니펫은 클라이언트 HTML 에 직접 주입되는 구조이므로 XSS 위험이 있다.
- **제안**:
  1. `WebChatAppearanceDto` 의 `@MaxLength`, `@IsEnum`, `@Matches` 등 validation decorator 적용 현황을 코드에서 확인하고 spec §4 에 필드별 제약(최대 길이, 허용 문자)을 표로 명시한다.
  2. 설치 스니펫 생성(`snippet.ts`) 시 자유 텍스트 필드를 JSON 직렬화 + HTML escape 처리하는지 확인한다. `JSON.stringify` 만으로는 `</script>` 가 포함된 값에서 XSS 가 발생할 수 있으므로 스크립트 인라인 직렬화 시 `</` → `<\/` 치환 등의 추가 처리가 필요하다.

---

### **[INFO]** `primaryColor` hex 값 — CSS injection 가능성

- **위치**: `spec/5-system/14-external-interaction-api.md` — `"primaryColor": "#5B4FE9"` 예시, `WebChatAppearanceDto` hex 검증 언급
- **상세**: `primaryColor` 가 스니펫·위젯 boot config 에 포함되고, 위젯 CSS 변수로 주입될 가능성이 있다. 서버가 hex 형식을 검증(`#RRGGBB`)한다고 명시하나, 위젯 내부에서 이 값을 CSS 에 직접 삽입하는 방식(예: `style="--primary-color: ${primaryColor}"`)에서는 서버 검증이 충분하더라도 CSS injection 가능성이 있다(`#fff; } body { display: none`).
- **제안**: 위젯이 `primaryColor` 를 CSS 에 삽입하기 전 `#` + 6자리/3자리 hex 문자만 허용하는 regex 재검증을 클라이언트 위젯 코드에서도 수행한다. 서버 검증이 통과한 값도 위젯 렌더링 레이어에서 한 번 더 형식 확인하는 "defense in depth" 적용.

---

### **[INFO]** 하드코딩된 시크릿 없음 확인

- **위치**: 검토된 모든 파일
- **상세**: 리뷰 대상 파일(spec 문서, consistency review 산출물)에 하드코딩된 API 키, 비밀번호, 토큰, 인증서 등은 발견되지 않았다. `_retry_state.json` 의 절대 경로(`/Volumes/project/private/clemvion/...`)는 로컬 개발 경로로, 프로덕션 배포에 포함되지 않는 내부 워크플로우 파일이다.

---

### **[INFO]** `interactionEnabled` JSONB 필터 — SQL injection 위험 없음 확인

- **위치**: `spec/2-navigation/2-trigger-list.md` — `GET /api/triggers?interactionEnabled=true` JSONB 필터
- **상세**: `interactionEnabled` 쿼리 파라미터가 `config.interaction.enabled` JSONB 필드 비교에 사용된다. NestJS/TypeORM 기반이라면 parameterized query 로 처리되어 SQL injection 위험이 낮다. 단, JSONB 경로 연산자를 raw query 로 구현한 경우 파라미터가 경로 식 자체에 삽입되면 위험할 수 있다.
- **제안**: 백엔드 `QueryTriggerDto` 에서 `interactionEnabled` 를 boolean 으로 변환(`@Transform(() => Boolean)`)한 후, 고정된 JSONB 경로 식(`config -> 'interaction' ->> 'enabled'`)과 파라미터 바인딩을 사용하는지 코드 레벨에서 확인한다.

---

## 요약

이번 변경의 핵심 보안 면은 (1) same-origin 동봉 iframe 의 `allow-same-origin` sandbox 트레이드오프, (2) 클라이언트 생성 `endpointPath` 의 서버 측 검증, (3) 공개·무인증 embed-config 엔드포인트의 캐시 정책, (4) `appearance` 서버 저장에서의 PATCH 통째 교체에 의한 데이터 소실 및 권한 있는 사용자에 의한 의도적 삭제 가능성이다. 특히 `allow-same-origin` + `allow-scripts` 조합은 spec 에 트레이드오프가 문서화되어 있으나, 공급망 위험 시나리오에서 admin 콘솔 전체 세션이 노출될 수 있어 경감 방안(SRI, CSP, 외부 CDN 시 cross-origin 전환)을 추가로 검토할 것을 권장한다. `WebChatAppearanceDto` 다층 검증과 스니펫 XSS 방어는 spec 이 언급하나 구현 검증이 필요하며, 자유 텍스트 필드의 HTML escape 처리 및 스크립트 인라인 직렬화 안전성은 별도 코드 리뷰에서 확인이 필요하다. 하드코딩된 시크릿, 명시적 SQL injection, LDAP/커맨드 인젝션 위험은 발견되지 않았다.

---

## 위험도

MEDIUM
