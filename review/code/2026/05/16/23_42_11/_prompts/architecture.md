# 아키텍처(Architecture) Review Payload

본 파일은 orchestrator 가 아키텍처(Architecture) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 아키텍처 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (아키텍처(Architecture))

1. **SOLID 원칙**: 단일 책임, 개방-폐쇄, 리스코프 치환, 인터페이스 분리, 의존성 역전
2. **결합도/응집도**: 모듈 간 결합도가 낮고 응집도가 높은지
3. **레이어 책임**: 프레젠테이션/비즈니스/데이터 레이어 책임 분리
4. **디자인 패턴**: 적절한 패턴 사용 여부, 안티패턴 존재 여부
5. **순환 의존성**: 모듈/패키지 간 순환 참조 여부
6. **추상화 수준**: 적절한 추상화 레벨, 과도하거나 부족한 추상화
7. **모듈 경계**: 모듈/서비스 간 경계가 명확한지
8. **확장성**: 향후 기능 확장에 유연한 구조인지

## 리뷰 대상 파일

### 파일 1: README.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/README.md b/README.md
index db9566e9..84e89b11 100644
--- a/README.md
+++ b/README.md
@@ -330,8 +330,8 @@ kubectl apply -k k8s/overlays/staging    # 스테이징
 
 자세한 사용법(SealedSecrets 통합, Ingress 컨트롤러별 annotation, ArgoCD PreSync hook 등)은 [`k8s/README.md`](./k8s/README.md) 를 참고하세요.
 
-# integration (SSO)
-## Google OAuth 연동 설정
+## integration (SSO)
+### Google OAuth 연동 설정
 
 1. Google Cloud Console에서 OAuth 클라이언트 생성
 

```

---

### 파일 2: backend/migrations/V052__notification_type_integration_action_required.sql
- 변경 유형: Review
- 언어: sql

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/migrations/V052__notification_type_integration_action_required.sql b/backend/migrations/V052__notification_type_integration_action_required.sql
new file mode 100644
index 00000000..6d65e96f
--- /dev/null
+++ b/backend/migrations/V052__notification_type_integration_action_required.sql
@@ -0,0 +1,19 @@
+-- V052: notification.type CHECK constraint 에 'integration_action_required' 추가
+--
+-- IntegrationActionRequiredNotifierService 가 INSERT 하는 type 값이
+-- V001 의 CHECK 화이트리스트에 빠져 있어 운영 환경에서 check_violation 으로
+-- 알림 발사가 실패하던 결함을 해소한다. (Review C-9)
+
+ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;
+
+ALTER TABLE notification
+    ADD CONSTRAINT notification_type_check
+    CHECK (type IN (
+        'execution_failed',
+        'background_failed',
+        'schedule_failed',
+        'integration_expired',
+        'integration_action_required',
+        'marketplace_update',
+        'team_invite'
+    ));

```

---

### 파일 3: backend/migrations/V053__notification_workspace_type_resource_idx.conf
- 변경 유형: Review
- 언어: conf

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/migrations/V053__notification_workspace_type_resource_idx.conf b/backend/migrations/V053__notification_workspace_type_resource_idx.conf
new file mode 100644
index 00000000..73bd53a1
--- /dev/null
+++ b/backend/migrations/V053__notification_workspace_type_resource_idx.conf
@@ -0,0 +1 @@
+executeInTransaction=false

```

---

### 파일 4: backend/migrations/V053__notification_workspace_type_resource_idx.sql
- 변경 유형: Review
- 언어: sql

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/migrations/V053__notification_workspace_type_resource_idx.sql b/backend/migrations/V053__notification_workspace_type_resource_idx.sql
new file mode 100644
index 00000000..18c09973
--- /dev/null
+++ b/backend/migrations/V053__notification_workspace_type_resource_idx.sql
@@ -0,0 +1,13 @@
+-- V053: NotificationsService.hasRecentByResource 의 idempotency 쿼리용 복합 인덱스
+--
+-- 쿼리 형태:
+--   SELECT COUNT(*) FROM notification
+--    WHERE workspace_id = $1 AND type = $2 AND resource_id = $3 AND title = $4
+--      AND created_at >= $5
+--
+-- 현재는 workspace_id 인덱스만 있어 type/resource_id 카디널리티가 낮은 환경에서
+-- seq scan 으로 회귀할 수 있다. 알림 발사 hot path 이므로 복합 인덱스를 둔다.
+-- CONCURRENTLY 사용을 위해 트랜잭션 밖에서 실행 (.conf executeInTransaction=false).
+
+CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_workspace_type_resource
+    ON notification (workspace_id, type, resource_id, created_at DESC);

```

---

### 파일 5: backend/package-lock.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/package-lock.json b/backend/package-lock.json
index ede03fa2..51b98569 100644
--- a/backend/package-lock.json
+++ b/backend/package-lock.json
@@ -3710,6 +3710,32 @@
         }
       }
     },
+    "node_modules/@nestjs-modules/mailer/node_modules/chokidar": {
+      "version": "3.6.0",
+      "resolved": "https://registry.npmjs.org/chokidar/-/chokidar-3.6.0.tgz",
+      "integrity": "sha512-7VT13fmjotKpGipCW9JEQAusEPE+Ei8nl6/g4FBAmIm0GOOLMua9NDDo/DWp0ZAxCr3cPq5ZpBqmPAQgDda2Pw==",
+      "license": "MIT",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "anymatch": "~3.1.2",
+        "braces": "~3.0.2",
+        "glob-parent": "~5.1.2",
+        "is-binary-path": "~2.1.0",
+        "is-glob": "~4.0.1",
+        "normalize-path": "~3.0.0",
+        "readdirp": "~3.6.0"
+      },
+      "engines": {
+        "node": ">= 8.10.0"
+      },
+      "funding": {
+        "url": "https://paulmillr.com/funding/"
+      },
+      "optionalDependencies": {
+        "fsevents": "~2.3.2"
+      }
+    },
     "node_modules/@nestjs-modules/mailer/node_modules/commander": {
       "version": "5.1.0",
       "resolved": "https://registry.npmjs.org/commander/-/commander-5.1.0.tgz",
@@ -3720,6 +3746,20 @@
         "node": ">= 6"
       }
     },
+    "node_modules/@nestjs-modules/mailer/node_modules/glob-parent": {
+      "version": "5.1.2",
+      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
+      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
+      "license": "ISC",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "is-glob": "^4.0.1"
+      },
+      "engines": {
+        "node": ">= 6"
+      }
+    },
     "node_modules/@nestjs-modules/mailer/node_modules/nunjucks": {
       "version": "3.2.4",
       "resolved": "https://registry.npmjs.org/nunjucks/-/nunjucks-3.2.4.tgz",
@@ -3746,6 +3786,20 @@
         }
       }
     },
+    "node_modules/@nestjs-modules/mailer/node_modules/readdirp": {
+      "version": "3.6.0",
+      "resolved": "https://registry.npmjs.org/readdirp/-/readdirp-3.6.0.tgz",
+      "integrity": "sha512-hOS089on8RduqdbhvQ5Z37A0ESjsqz6qnRcffsMU3495FuTdqSm+7bhJ29JvIOsBDEEnan5DPu9t3To9VRlMzA==",
+      "license": "MIT",
+      "optional": true,
+      "peer": true,
+      "dependencies": {
+        "picomatch": "^2.2.1"
+      },
+      "engines": {
+        "node": ">=8.10.0"
+      }
+    },
     "node_modules/@nestjs/bull-shared": {
       "version": "11.0.4",
       "resolved": "https://registry.npmjs.org/@nestjs/bull-shared/-/bull-shared-11.0.4.tgz",
@@ -7032,9 +7086,9 @@
       "license": "BSD-3-Clause"
     },
     "node_modules/@protobufjs/codegen": {
-      "version": "2.0.4",
-      "resolved": "https://registry.npmjs.org/@protobufjs/codegen/-/codegen-2.0.4.tgz",
-      "integrity": "sha512-YyFaikqM5sH0ziFZCN3xDC7zeGaB/d0IUb9CATugHWbd1FRFwWwt4ld4OYMPWu5a3Xe01mGAULCdqhMlPl29Jg==",
+      "version": "2.0.5",
+      "resolved": "https://registry.npmjs.org/@protobufjs/codegen/-/codegen-2.0.5.tgz",
+      "integrity": "sha512-zgXFLzW3Ap33e6d0Wlj4MGIm6Ce8O89n/apUaGNB/jx+hw+ruWEp7EwGUshdLKVRCxZW12fp9r40E1mQrf/34g==",
       "license": "BSD-3-Clause"
     },
     "node_modules/@protobufjs/eventemitter": {
@@ -7060,9 +7114,9 @@
       "license": "BSD-3-Clause"
     },
     "node_modules/@protobufjs/inquire": {
-      "version": "1.1.0",
-      "resolved": "https://registry.npmjs.org/@protobufjs/inquire/-/inquire-1.1.0.tgz",
-      "integrity": "sha512-kdSefcPdruJiFMVSbn801t4vFK7KB/5gd2fYvrxhuJYg8ILrmn9SKSX2tZdV6V+ksulWqS7aXjBcRXl3wHoD9Q==",
+      "version": "1.1.1",
+      "resolved": "https://registry.npmjs.org/@protobufjs/inquire/-/inquire-1.1.1.tgz",
+      "integrity": "sha512-mnzgDV26ueAvk7rsbt9L7bE0SuAoqyuys/sMMrmVcN5x9VsxpcG3rqAUSgDyLp0UZlmNfIbQ4fHfCtreVBk8Ew==",
       "license": "BSD-3-Clause"
     },
     "node_modules/@protobufjs/path": {
@@ -7078,9 +7132,9 @@
       "license": "BSD-3-Clause"
     },
     "node_modules/@protobufjs/utf8": {
-      "version": "1.1.0",
-      "resolved": "https://registry.npmjs.org/@protobufjs/utf8/-/utf8-1.1.0.tgz",
-      "integrity": "sha512-Vvn3zZrhQZkkBE8LSuW3em98c0FwgO4nxzv6OdSxPKJIEKY2bGbHn+mhGIPerzI4twdxaP8/0+06HBpwf345Lw==",
+      "version": "1.1.1",
+      "resolved": "https://registry.npmjs.org/@protobufjs/utf8/-/utf8-1.1.1.tgz",
+      "integrity": "sha512-oOAWABowe8EAbMyWKM0tYDKi8Yaox52D+HWZhAIJqQXbqe0xI/GV7FhLWqlEKreMkfDjshR5FKgi3mnle0h6Eg==",
       "license": "BSD-3-Clause"
     },
     "node_modules/@scarf/scarf": {
@@ -11941,9 +11995,9 @@
       "license": "Unlicense"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.0",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.0.tgz",
-      "integrity": "sha512-iPeeDKJSWf4IEOasVVrknXpaBV0IApz/gp7S2bb7Z4Lljbl2MGJRqInZiUrQwV16cpzw/D3S5j5Julj/gT52AA==",
+      "version": "3.1.2",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.2.tgz",
+      "integrity": "sha512-rVjf7ArG3LTk+FS6Yw81V1DLuZl1bRbNrev6Tmd/9RaroeeRRJhAt7jg/6YFxbvAQXUCavSoZhPPj6oOx+5KjQ==",
       "funding": [
         {
           "type": "github",
@@ -17716,22 +17770,22 @@
       }
     },
     "node_modules/protobufjs": {
-      "version": "7.5.5",
-      "resolved": "https://registry.npmjs.org/protobufjs/-/protobufjs-7.5.5.tgz",
-      "integrity": "sha512-3wY1AxV+VBNW8Yypfd1yQY9pXnqTAN+KwQxL8iYm3/BjKYMNg4i0owhEe26PWDOMaIrzeeF98Lqd5NGz4omiIg==",
+      "version": "7.5.8",
+      "resolved": "https://registry.npmjs.org/protobufjs/-/protobufjs-7.5.8.tgz",
+      "integrity": "sha512-dvpCIeLPbXZS/Ete7yLaO7RenOdken2NHKykBXbsaGxZT0UTltcarBciw+A78SRQs9iMAAVpsYA+l8b1hTePIA==",
       "hasInstallScript": true,
       "license": "BSD-3-Clause",
       "dependencies": {
         "@protobufjs/aspromise": "^1.1.2",
         "@protobufjs/base64": "^1.1.2",
-        "@protobufjs/codegen": "^2.0.4",
+        "@protobufjs/codegen": "^2.0.5",
         "@protobufjs/eventemitter": "^1.1.0",
         "@protobufjs/fetch": "^1.1.0",
         "@protobufjs/float": "^1.0.2",
-        "@protobufjs/inquire": "^1.1.0",
+        "@protobufjs/inquire": "^1.1.1",
         "@protobufjs/path": "^1.1.2",
         "@protobufjs/pool": "^1.1.0",
-        "@protobufjs/utf8": "^1.1.0",
+        "@protobufjs/utf8": "^1.1.1",
         "@types/node": ">=13.7.0",
         "long": "^5.0.0"
       },
@@ -20015,6 +20069,7 @@
       "version": "3.19.3",
       "resolved": "https://registry.npmjs.org/uglify-js/-/uglify-js-3.19.3.tgz",
       "integrity": "sha512-v3Xu+yuwBXisp6QYTcH4UbH+xYJXqnq2m/LtQVWKWzYc1iehYnLixoQDN9FH6/j9/oybfd6W9Ghwkl8+UMKTKQ==",
+      "dev": true,
       "license": "BSD-2-Clause",
       "optional": true,
       "bin": {

```

---

### 파일 6: backend/package.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/package.json b/backend/package.json
index 0338bd65..6774087d 100644
--- a/backend/package.json
+++ b/backend/package.json
@@ -115,6 +115,8 @@
     "picomatch": "^4.0.4",
     "liquidjs": "^10.25.7",
     "ip-address": "^10.2.0",
-    "express-rate-limit": "^8.5.1"
+    "express-rate-limit": "^8.5.1",
+    "protobufjs": "^7.5.6",
+    "fast-uri": "^3.1.2"
   }
 }

```

---

### 파일 7: backend/src/common/dto/pagination.dto.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/common/dto/pagination.dto.ts b/backend/src/common/dto/pagination.dto.ts
index f3a5dd58..3a8cb6e4 100644
--- a/backend/src/common/dto/pagination.dto.ts
+++ b/backend/src/common/dto/pagination.dto.ts
@@ -6,6 +6,7 @@ import {
   IsString,
   IsIn,
   MaxLength,
+  Matches,
 } from 'class-validator';
 import { Type } from 'class-transformer';
 import { ApiPropertyOptional } from '@nestjs/swagger';
@@ -47,6 +48,13 @@ export class PaginationQueryDto {
   })
   @IsOptional()
   @IsString()
+  @MaxLength(64)
+  // 안전한 컬럼명 패턴 (영문/숫자/밑줄). 서비스별 화이트리스트(`getSortColumn`)가
+  // 다층 방어를 제공하지만 DTO 레벨에서 raw SQL 식별자에 들어갈 수 있는 위험
+  // 문자를 1차 차단해 ORDER BY 인젝션 / 식별자 우회를 막는다.
+  @Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
+    message: 'sort must be alphanumeric/underscore identifier',
+  })
   sort?: string = 'created_at';
 
   /** 정렬 방향 (asc | desc) */

```

---

### 파일 8: backend/src/main.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/main.ts b/backend/src/main.ts
index 25670b35..ac3542b0 100644
--- a/backend/src/main.ts
+++ b/backend/src/main.ts
@@ -34,7 +34,9 @@ async function bootstrap() {
     );
   }
 
-  const app = await NestFactory.create(AppModule);
+  // rawBody: true 는 HMAC 웹훅(`HooksService.verifyAuth`) 의 서명 검증에 필수다.
+  // 미설정 시 `req.rawBody` 가 undefined 가 되어 HMAC 분기가 항상 401 을 반환한다.
+  const app = await NestFactory.create(AppModule, { rawBody: true });
   const configService = app.get(ConfigService);
 
   // Cloudflare(또는 단일 reverse proxy) 한 단계 뒤에서 동작하므로 hop 1 만

```

---

### 파일 9: backend/src/modules/execution-engine/execution-engine.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/execution-engine/execution-engine.service.ts b/backend/src/modules/execution-engine/execution-engine.service.ts
index 76250691..241c7dc3 100644
--- a/backend/src/modules/execution-engine/execution-engine.service.ts
+++ b/backend/src/modules/execution-engine/execution-engine.service.ts
@@ -3634,6 +3634,7 @@ export class ExecutionEngineService
     // infinite loop or stack overflow.
     this.assertNoContainerCycle(containerNode, allNodes);
 
+    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
     const children = allNodes.filter((n) => n.containerId === containerNode.id);
     const childIds = new Set(children.map((c) => c.id));
 
@@ -3676,7 +3677,7 @@ export class ExecutionEngineService
       if (orphanEmitEdges.length > 0) {
         const sourceLabels = orphanEmitEdges
           .map((e) => {
-            const sourceNode = allNodes.find((n) => n.id === e.sourceNodeId);
+            const sourceNode = nodeMap.get(e.sourceNodeId);
             return sourceNode?.label ?? sourceNode?.type ?? e.sourceNodeId;
           })
           .join(', ');
@@ -3732,7 +3733,7 @@ export class ExecutionEngineService
       internalEdges,
       sortedNodeIds,
       outgoingEdgeMap,
-      nodeMap: new Map(allNodes.map((n) => [n.id, n])),
+      nodeMap,
     };
   }
 

```

---

### 파일 10: backend/src/modules/executions/executions.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/executions/executions.service.spec.ts b/backend/src/modules/executions/executions.service.spec.ts
index a7638986..486e28b3 100644
--- a/backend/src/modules/executions/executions.service.spec.ts
+++ b/backend/src/modules/executions/executions.service.spec.ts
@@ -351,6 +351,7 @@ describe('ExecutionsService', () => {
         where: { executionId: 'eF1' },
         order: { id: 'ASC' },
         select: { nodeId: true },
+        take: 10_000,
       });
     });
 

```

---

### 파일 11: backend/src/modules/executions/executions.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/executions/executions.service.ts b/backend/src/modules/executions/executions.service.ts
index c55bd5a9..ea4f6c98 100644
--- a/backend/src/modules/executions/executions.service.ts
+++ b/backend/src/modules/executions/executions.service.ts
@@ -18,6 +18,11 @@ import {
 } from './utils/execution-trigger';
 import { loadParentWorkflowNames } from './utils/load-parent-workflow-names';
 
+// execution_node_log 행 수 상한. ForEach 같은 컨테이너에서 행 수가 폭증하는 경우
+// 메모리 적재량을 묶어두기 위한 안전망 — UI timeline 은 정렬된 nodeId prefix 만
+// 필요하므로 상한을 초과한 경우는 잘려도 표시 흐름은 유지된다.
+const MAX_EXECUTION_PATH_ROWS = 10_000;
+
 /**
  * `findById` 응답 — 기존 entity 형태(websocket snapshot/frontend 호환)에
  * triggerSource/triggerLabel 두 필드를 추가한 shape. `executionPath` 는
@@ -120,10 +125,14 @@ export class ExecutionsService {
           // executionPath 는 execution_node_log 의 (execution_id, id) 순서로
           // 채운다. BIGSERIAL `id` 가 단조증가이므로 다중 인스턴스 환경에서도
           // 단일 source of truth 를 유지한다.
+          // 대규모 ForEach 실행에서 로그 행이 수만 건에 달할 수 있어 안전 상한을
+          // 둔다 — UI 가 timeline 을 그리는 데 필요한 prefix 만 필요하므로
+          // MAX_EXECUTION_PATH_ROWS 까지만 가져온다.
           manager.find(ExecutionNodeLog, {
             where: { executionId: id },
             order: { id: 'ASC' },
             select: { nodeId: true },
+            take: MAX_EXECUTION_PATH_ROWS,
           }),
         ]);
         const executionPath = pathRows.map((r) => r.nodeId);

```

---

### 파일 12: backend/src/modules/hooks/hooks.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/hooks/hooks.service.spec.ts b/backend/src/modules/hooks/hooks.service.spec.ts
index d6cd3b71..b3ef1e5d 100644
--- a/backend/src/modules/hooks/hooks.service.spec.ts
+++ b/backend/src/modules/hooks/hooks.service.spec.ts
@@ -1,10 +1,12 @@
 import { Test } from '@nestjs/testing';
 import { getRepositoryToken } from '@nestjs/typeorm';
 import { Repository } from 'typeorm';
+import { createHmac } from 'crypto';
 import {
   BadRequestException,
   GoneException,
   NotFoundException,
+  UnauthorizedException,
 } from '@nestjs/common';
 import { HooksService, WebhookInput } from './hooks.service';
 import { Trigger } from '../triggers/entities/trigger.entity';
@@ -167,6 +169,131 @@ describe('HooksService', () => {
     ]);
   });
 
+  describe('auth — bearer / HMAC (constantTimeEquals coverage)', () => {
+    const bearerTrigger: Trigger = {
+      ...activeTrigger,
+      config: { authType: 'bearer', bearerToken: 'sekret-token-1234' },
+    };
+
+    const hmacSecret = 'webhook-secret';
+    const hmacTrigger: Trigger = {
+      ...activeTrigger,
+      config: {
+        authType: 'hmac',
+        secret: hmacSecret,
+        hmacHeader: 'x-hub-signature-256',
+        hmacAlgorithm: 'sha256',
+      },
+    };
+
+    const noTriggerParamsNode = {
+      id: 'n',
+      workflowId: 'wf1',
+      type: 'manual_trigger',
+      category: NodeCategory.TRIGGER,
+      config: {},
+    } as unknown as Node;
+
+    it('bearer: rejects when token is missing', async () => {
+      triggerRepo.findOne.mockResolvedValue(bearerTrigger);
+      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
+      await expect(service.handleWebhook('abc', input)).rejects.toBeInstanceOf(
+        UnauthorizedException,
+      );
+    });
+
+    it('bearer: rejects on length mismatch (constantTimeEquals fast-path)', async () => {
+      triggerRepo.findOne.mockResolvedValue(bearerTrigger);
+      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
+      const headers = { authorization: 'Bearer short' };
+      await expect(
+        service.handleWebhook('abc', { ...input, headers }),
+      ).rejects.toBeInstanceOf(UnauthorizedException);
+    });
+
+    it('bearer: rejects on equal-length mismatch', async () => {
+      triggerRepo.findOne.mockResolvedValue(bearerTrigger);
+      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
+      const headers = { authorization: 'Bearer sekret-token-0000' };
+      await expect(
+        service.handleWebhook('abc', { ...input, headers }),
+      ).rejects.toBeInstanceOf(UnauthorizedException);
+    });
+
+    it('bearer: accepts valid token (constantTimeEquals match)', async () => {
+      triggerRepo.findOne.mockResolvedValue(bearerTrigger);
+      triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
+      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
+      engine.execute.mockResolvedValue('exec-bearer');
+      const headers = { authorization: 'Bearer sekret-token-1234' };
+      const res = await service.handleWebhook('abc', { ...input, headers });
+      expect(res).toEqual({ executionId: 'exec-bearer' });
+    });
+
+    it('hmac: rejects when signature header is missing', async () => {
+      triggerRepo.findOne.mockResolvedValue(hmacTrigger);
+      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
+      const rawBody = Buffer.from(JSON.stringify(input.body));
+      await expect(
+        service.handleWebhook('abc', input, rawBody),
+      ).rejects.toBeInstanceOf(UnauthorizedException);
+    });
+
+    it('hmac: rejects when rawBody is undefined', async () => {
+      triggerRepo.findOne.mockResolvedValue(hmacTrigger);
+      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
+      const headers = { 'x-hub-signature-256': 'sha256=deadbeef' };
+      await expect(
+        service.handleWebhook('abc', { ...input, headers }),
+      ).rejects.toBeInstanceOf(UnauthorizedException);
+    });
+
+    it('hmac: rejects on signature mismatch', async () => {
+      triggerRepo.findOne.mockResolvedValue(hmacTrigger);
+      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
+      const rawBody = Buffer.from(JSON.stringify(input.body));
+      const wrong = `sha256=${createHmac('sha256', 'WRONG-SECRET').update(rawBody).digest('hex')}`;
+      const headers = { 'x-hub-signature-256': wrong };
+      await expect(
+        service.handleWebhook('abc', { ...input, headers }, rawBody),
+      ).rejects.toBeInstanceOf(UnauthorizedException);
+    });
+
+    it('hmac: accepts valid sha256 signature', async () => {
+      triggerRepo.findOne.mockResolvedValue(hmacTrigger);
+      triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));
+      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
+      engine.execute.mockResolvedValue('exec-hmac');
+      const rawBody = Buffer.from(JSON.stringify(input.body));
+      const sig = `sha256=${createHmac('sha256', hmacSecret).update(rawBody).digest('hex')}`;
+      const headers = { 'x-hub-signature-256': sig };
+      const res = await service.handleWebhook(
+        'abc',
+        { ...input, headers },
+        rawBody,
+      );
+      expect(res).toEqual({ executionId: 'exec-hmac' });
+    });
+
+    it('hmac: rejects unsupported algorithm (allowlist)', async () => {
+      triggerRepo.findOne.mockResolvedValue({
+        ...activeTrigger,
+        config: {
+          authType: 'hmac',
+          secret: hmacSecret,
+          hmacHeader: 'x-hub-signature-256',
+          hmacAlgorithm: 'md5',
+        },
+      });
+      nodeRepo.findOne.mockResolvedValue(noTriggerParamsNode);
+      const rawBody = Buffer.from(JSON.stringify(input.body));
+      const headers = { 'x-hub-signature-256': 'md5=deadbeef' };
+      await expect(
+        service.handleWebhook('abc', { ...input, headers }, rawBody),
+      ).rejects.toBeInstanceOf(UnauthorizedException);
+    });
+  });
+
   it('passes { parameters: {} } when workflow has no trigger parameters schema', async () => {
     triggerRepo.findOne.mockResolvedValue(activeTrigger);
     triggerRepo.save.mockImplementation((t) => Promise.resolve(t as Trigger));

```

---

### 파일 13: backend/src/modules/hooks/hooks.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/hooks/hooks.service.ts b/backend/src/modules/hooks/hooks.service.ts
index 4817c83d..b063d9d2 100644
--- a/backend/src/modules/hooks/hooks.service.ts
+++ b/backend/src/modules/hooks/hooks.service.ts
@@ -16,6 +16,8 @@ import { loadTriggerParameterSchema } from '../execution-engine/utils/load-trigg
 import { TriggerParameterValidationException } from '../execution-engine/types/trigger-parameter.types';
 import * as crypto from 'crypto';
 
+const HMAC_ALLOWED_ALGORITHMS = new Set(['sha256', 'sha512']);
+
 interface WebhookConfig {
   authType?: 'none' | 'hmac' | 'bearer';
   secret?: string;
@@ -142,6 +144,14 @@ export class HooksService {
         config.hmacHeader ?? 'x-hub-signature-256'
       ).toLowerCase();
       const algorithm = config.hmacAlgorithm ?? 'sha256';
+      // 알고리즘 허용 목록. 외부 입력(트리거 설정)이 그대로 crypto.createHmac 에
+      // 전달되므로 화이트리스트로 좁혀 임의 알고리즘·낮은 보안 다이제스트 사용을 차단한다.
+      if (!HMAC_ALLOWED_ALGORITHMS.has(algorithm)) {
+        throw new UnauthorizedException({
+          code: 'AUTH_FAILED',
+          message: `Unsupported HMAC algorithm: ${algorithm}`,
+        });
+      }
       const signature = headers[hmacHeader] ?? '';
       const secret = config.secret ?? '';
 

```

---

### 파일 14: backend/src/modules/integrations/integration-oauth.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/integrations/integration-oauth.service.ts b/backend/src/modules/integrations/integration-oauth.service.ts
index edbaa9be..79d1ba64 100644
--- a/backend/src/modules/integrations/integration-oauth.service.ts
+++ b/backend/src/modules/integrations/integration-oauth.service.ts
@@ -279,6 +279,9 @@ function normalizeRawStateRow(
   } as IntegrationOAuthState;
 }
 
+// 모듈 수준 logger — class instance 외부의 normalize 헬퍼들이 사용. (W-31)
+const moduleLogger = new Logger('IntegrationOAuthService');
+
 /**
  * preview row 의 raw → entity 정규화. credentials JSONB 도 `decryptJson`
  * 으로 복호화한다 (state row 와 동일 transformer 패턴).
@@ -304,7 +307,7 @@ function normalizeRawPreviewRow(
     // 암호화 invariant 를 우회하는 경로를 열어둔다. 명시적으로 invalid 로
     // 마크해 호출자가 `OAUTH_PREVIEW_INVALID` 분기로 처리하게 한다.
     // 운영 진단을 위해 warn 로그도 함께 남긴다.
-    console.warn(
+    moduleLogger.warn(
       `[security] preview row credentials is plaintext (no 'enc:' prefix) — refusing to consume. previewToken=${typeof raw.preview_token === 'string' ? raw.preview_token.slice(0, 8) : 'unknown'}…`,
     );
     credentials = { __invalid: true };

```

---

### 파일 15: backend/src/modules/integrations/integrations.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/integrations/integrations.service.ts b/backend/src/modules/integrations/integrations.service.ts
index 7d20719e..2210df9b 100644
--- a/backend/src/modules/integrations/integrations.service.ts
+++ b/backend/src/modules/integrations/integrations.service.ts
@@ -699,7 +699,7 @@ export class IntegrationsService {
       );
     } catch (err) {
       // Usage logging must not break execution — swallow and continue.
-      console.warn(
+      this.logger.warn(
         `Failed to log integration usage: ${err instanceof Error ? err.message : String(err)}`,
       );
     }

```

---

### 파일 16: backend/src/modules/integrations/services/credentials-transformer.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/integrations/services/credentials-transformer.ts b/backend/src/modules/integrations/services/credentials-transformer.ts
index 8378c5ea..e376ce56 100644
--- a/backend/src/modules/integrations/services/credentials-transformer.ts
+++ b/backend/src/modules/integrations/services/credentials-transformer.ts
@@ -4,8 +4,11 @@ import {
   createHash,
   randomBytes,
 } from 'crypto';
+import { Logger } from '@nestjs/common';
 import { ValueTransformer } from 'typeorm';
 
+const logger = new Logger('IntegrationCredentialsTransformer');
+
 /**
  * AES-256-GCM ValueTransformer for sensitive JSONB credentials.
  * Stored format (base64 of): version(1B) || iv(12B) || authTag(16B) || ciphertext
@@ -42,8 +45,8 @@ function getKey(): Buffer | null {
   const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
   if (!raw) {
     if (!warnedMissingKey) {
-      console.warn(
-        '[integrations] INTEGRATION_ENCRYPTION_KEY is not set — credentials are stored unencrypted. Set a 32+ byte secret for production.',
+      logger.warn(
+        'INTEGRATION_ENCRYPTION_KEY is not set — credentials are stored unencrypted. Set a 32+ byte secret for production.',
       );
       warnedMissingKey = true;
     }
@@ -55,8 +58,8 @@ function getKey(): Buffer | null {
 
 function unreadable(original?: unknown): Record<string, unknown> {
   if (!warnedUnreadable) {
-    console.warn(
-      '[integrations] decryptJson failed for a stored credential — surfacing as needs_reauth. Further occurrences suppressed.',
+    logger.warn(
+      'decryptJson failed for a stored credential — surfacing as needs_reauth. Further occurrences suppressed.',
     );
     warnedUnreadable = true;
   }

```

---

### 파일 17: backend/src/modules/statistics/statistics.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/statistics/statistics.service.ts b/backend/src/modules/statistics/statistics.service.ts
index 1f5a9078..5be913b9 100644
--- a/backend/src/modules/statistics/statistics.service.ts
+++ b/backend/src/modules/statistics/statistics.service.ts
@@ -83,7 +83,7 @@ export class StatisticsService {
   ): Promise<StatisticsSummary> {
     const { startDate, endDate } = this.resolveDateRange(query);
 
-    const result = await this.executionRepository
+    const qb = this.executionRepository
       .createQueryBuilder('e')
       .innerJoin('e.workflow', 'w')
       .select([
@@ -95,31 +95,15 @@ export class StatisticsService {
       ])
       .where('w.workspace_id = :workspaceId', { workspaceId })
       .andWhere('e.started_at >= :startDate', { startDate })
-      .andWhere('e.started_at <= :endDate', { endDate })
-      .getRawOne<Record<string, unknown>>();
+      .andWhere('e.started_at <= :endDate', { endDate });
 
     if (query.workflowId) {
-      const filtered = await this.executionRepository
-        .createQueryBuilder('e')
-        .innerJoin('e.workflow', 'w')
-        .select([
-          'COUNT(*)::int AS "totalExecutions"',
-          'COUNT(*) FILTER (WHERE e.status = \'completed\')::int AS "successCount"',
-          'COUNT(*) FILTER (WHERE e.status = \'failed\')::int AS "failedCount"',
-          'COUNT(*) FILTER (WHERE e.status = \'cancelled\')::int AS "cancelledCount"',
-          'COALESCE(AVG(e.duration_ms) FILTER (WHERE e.duration_ms IS NOT NULL), 0)::float AS "avgDurationMs"',
-        ])
-        .where('w.workspace_id = :workspaceId', { workspaceId })
-        .andWhere('e.workflow_id = :workflowId', {
-          workflowId: query.workflowId,
-        })
-        .andWhere('e.started_at >= :startDate', { startDate })
-        .andWhere('e.started_at <= :endDate', { endDate })
-        .getRawOne<Record<string, unknown>>();
-
-      return this.buildSummary(filtered ?? {});
+      qb.andWhere('e.workflow_id = :workflowId', {
+        workflowId: query.workflowId,
+      });
     }
 
+    const result = await qb.getRawOne<Record<string, unknown>>();
     return this.buildSummary(result ?? {});
   }
 

```

---

### 파일 18: backend/src/modules/websocket/websocket.gateway.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/websocket/websocket.gateway.ts b/backend/src/modules/websocket/websocket.gateway.ts
index 403f5d24..cf51e6ad 100644
--- a/backend/src/modules/websocket/websocket.gateway.ts
+++ b/backend/src/modules/websocket/websocket.gateway.ts
@@ -220,6 +220,17 @@ export class WebsocketGateway
           data: { success: false, error: rejection.error },
         };
       }
+      // authorize() 가 await 경계라 그 사이 동일 클라이언트의 다른 subscribe 가
+      // 진행되어 한도를 통과한 뒤 add 단계에 진입할 수 있다. 추가 직전 재검사.
+      if (clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION) {
+        return {
+          event: 'subscribed',
+          data: {
+            success: false,
+            error: `Maximum subscriptions (${MAX_SUBSCRIPTIONS_PER_CONNECTION}) reached`,
+          },
+        };
+      }
     }
 
     // Detect first-time subscription so we only send the snapshot once. A

```

---

### 파일 19: backend/src/modules/websocket/websocket.service.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/modules/websocket/websocket.service.ts b/backend/src/modules/websocket/websocket.service.ts
index 030a3bfb..94dc90a9 100644
--- a/backend/src/modules/websocket/websocket.service.ts
+++ b/backend/src/modules/websocket/websocket.service.ts
@@ -93,17 +93,30 @@ function sanitizePayloadForWs(value: unknown, depth = 0): unknown {
   if (depth > MAX_SANITIZE_DEPTH) return value;
   if (value === null || typeof value !== 'object') return value;
   if (Array.isArray(value)) {
-    return value.map((item) => sanitizePayloadForWs(item, depth + 1));
+    let mutated = false;
+    const out: unknown[] = new Array(value.length);
+    for (let i = 0; i < value.length; i++) {
+      const sanitized = sanitizePayloadForWs(value[i], depth + 1);
+      if (sanitized !== value[i]) mutated = true;
+      out[i] = sanitized;
+    }
+    return mutated ? out : value;
   }
-  const result: Record<string, unknown> = {};
-  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
+  let result: Record<string, unknown> | null = null;
+  const obj = value as Record<string, unknown>;
+  for (const [k, v] of Object.entries(obj)) {
     if (CREDENTIAL_KEY_PATTERN.test(k)) {
+      if (!result) result = { ...obj };
       result[k] = '[REDACTED]';
     } else {
-      result[k] = sanitizePayloadForWs(v, depth + 1);
+      const sanitized = sanitizePayloadForWs(v, depth + 1);
+      if (sanitized !== v) {
+        if (!result) result = { ...obj };
+        result[k] = sanitized;
+      }
     }
   }
-  return result;
+  return result ?? value;
 }
 
 /**

```

---

### 파일 20: backend/src/nodes/presentation/table/table.handler.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/src/nodes/presentation/table/table.handler.ts b/backend/src/nodes/presentation/table/table.handler.ts
index baadb4c3..da39fc15 100644
--- a/backend/src/nodes/presentation/table/table.handler.ts
+++ b/backend/src/nodes/presentation/table/table.handler.ts
@@ -1,3 +1,4 @@
+import { Logger } from '@nestjs/common';
 import {
   ExecutionContext,
   NodeHandler,
@@ -20,6 +21,7 @@ import { tableNodeMetadata } from './table.schema.js';
 type TableMode = 'static' | 'dynamic';
 
 const EXPRESSION_PATTERN = /\{\{/;
+const logger = new Logger('TableHandler');
 
 interface ColumnConfig {
   field: string;
@@ -261,12 +263,10 @@ export class TableHandler implements NodeHandler {
     try {
       return evaluate(template, ctx);
     } catch (e) {
-      console.error('[TableHandler] safeEvaluate error:', template, e);
-      console.error(
-        '[TableHandler] ctx.$sourceItem:',
-        JSON.stringify(ctx.$sourceItem),
+      logger.error(
+        `safeEvaluate error: template=${template} sourceItem=${JSON.stringify(ctx.$sourceItem)} var=${JSON.stringify(ctx.$var)}`,
+        e instanceof Error ? e.stack : String(e),
       );
-      console.error('[TableHandler] ctx.$var:', JSON.stringify(ctx.$var));
       return null;
     }
   }

```

---

### 파일 21: backend/test/webhook-trigger.e2e-spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/backend/test/webhook-trigger.e2e-spec.ts b/backend/test/webhook-trigger.e2e-spec.ts
index 68d61f5c..c16ee985 100644
--- a/backend/test/webhook-trigger.e2e-spec.ts
+++ b/backend/test/webhook-trigger.e2e-spec.ts
@@ -71,7 +71,7 @@ describe('Webhook trigger (e2e)', () => {
   }
 
   it('A. 활성 webhook 트리거 수신 → 202 + executionId', async () => {
-    const path = `e2e-a-${Date.now()}`;
+    const path = `e2e-a-${crypto.randomBytes(8).toString('hex')}`;
     await createWebhookTrigger(uniqueName('hook-a'), path);
 
     const res = await request(BASE_URL)
@@ -92,7 +92,7 @@ describe('Webhook trigger (e2e)', () => {
   });
 
   it('C. 비활성 트리거 → 410 TRIGGER_INACTIVE', async () => {
-    const path = `e2e-c-${Date.now()}`;
+    const path = `e2e-c-${crypto.randomBytes(8).toString('hex')}`;
     const triggerId = await createWebhookTrigger(uniqueName('hook-c'), path);
 
     // 비활성화.
@@ -109,7 +109,7 @@ describe('Webhook trigger (e2e)', () => {
   });
 
   it('D. bearer auth — 잘못된 토큰 401, 올바른 토큰 202', async () => {
-    const path = `e2e-d-${Date.now()}`;
+    const path = `e2e-d-${crypto.randomBytes(8).toString('hex')}`;
     const expectedToken = 'secret-token-abc';
     await createWebhookTrigger(uniqueName('hook-d'), path, {
       authType: 'bearer',
@@ -131,7 +131,7 @@ describe('Webhook trigger (e2e)', () => {
   });
 
   it('E. HMAC auth — 서명 누락 401, 올바른 서명 202', async () => {
-    const path = `e2e-e-${Date.now()}`;
+    const path = `e2e-e-${crypto.randomBytes(8).toString('hex')}`;
     const secret = 'super-secret-hmac-key';
     await createWebhookTrigger(uniqueName('hook-e'), path, {
       authType: 'hmac',

```

---

### 파일 22: frontend/README.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/frontend/README.md b/frontend/README.md
index 3238ab22..74c12253 100644
--- a/frontend/README.md
+++ b/frontend/README.md
@@ -6,14 +6,10 @@ First, run the development server:
 
 ```bash
 npm run dev
-# or
-yarn dev
-# or
-pnpm dev
-# or
-bun dev
 ```
 
+> 본 프로젝트는 npm 전용입니다. yarn / pnpm / bun 사용은 금지 (루트 CLAUDE.md "패키지 매니저" 참고).
+
 Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
 
 You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

```

---

### 파일 23: packages/expression-engine/README.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/packages/expression-engine/README.md b/packages/expression-engine/README.md
new file mode 100644
index 00000000..7509edaf
--- /dev/null
+++ b/packages/expression-engine/README.md
@@ -0,0 +1,41 @@
+# @workflow/expression-engine
+
+워크플로우 표현식 언어(`{{ ... }}`) 의 tokenizer / parser / AST evaluator. 백엔드와 프론트엔드가 같은 평가 의미를 공유하기 위한 SSOT 패키지다.
+
+스펙: [`spec/5-system/5-expression-language.md`](../../spec/5-system/5-expression-language.md)
+
+## 빌드
+
+```bash
+npm run build           # tsc 로 dist/ 생성
+npm run watch           # 변경 감시
+npm test                # jest 단위 테스트
+```
+
+`backend` 와 `frontend` 가 workspace dep 로 참조하므로 두 앱을 실행하기 전에 본 패키지가 한 번 build 되어 있어야 한다. 모노레포 루트에서 `make build` 또는 `npm -w @workflow/expression-engine run build` 로 일괄 처리한다.
+
+## 사용
+
+```ts
+import { evaluate } from '@workflow/expression-engine';
+
+const result = evaluate('{{ $input.name }}', {
+  $input: { name: 'world' },
+});
+```
+
+`evaluate` 는 부분 표현식(`Hello {{ name }}`) 과 단독 표현식(`{{ $now.iso }}`) 모두 처리한다.
+
+## 주요 export
+
+| Symbol | 설명 |
+|--------|------|
+| `evaluate(template, context, options?)` | 진입점. 문자열 템플릿 → 평가 결과 |
+| `ExpressionContext` | `$input` · `$node` · `$var` · `$now` · `$item` · `$loop` · `$user` 등 표준 컨텍스트 타입 |
+| `ExpressionError` / `ErrorCode` | 평가 실패 시 throw 되는 에러와 분류 코드 |
+| `ASTNode` | 외부에서 AST 를 다루는 도구가 참조 |
+
+## 의존성·boundary
+
+- **Node-only**: 빌드 아티팩트는 ESM/CJS 양쪽으로 emit 하지만, 외부 의존 코드는 plain TS 만 사용. `liquidjs` 등 외부 평가 엔진은 사용하지 않는다 (샌드박스 invariant 보존).
+- **Single direction**: `@workflow/node-summary` · `backend` · `frontend` 가 본 패키지를 참조한다. 본 패키지는 다른 `packages/*` 를 참조하지 않는다.

```

---

### 파일 24: packages/node-summary/README.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/packages/node-summary/README.md b/packages/node-summary/README.md
new file mode 100644
index 00000000..6ad6b85a
--- /dev/null
+++ b/packages/node-summary/README.md
@@ -0,0 +1,61 @@
+# @workflow/node-summary
+
+노드 config 에 대한 경고(`warningRules`) 평가와 캔버스/리뷰용 요약 템플릿(`summaryTemplate`) 렌더링의 SSOT.
+
+- 프론트엔드: 캔버스 노드 카드의 ⚠ 배지·요약 라벨 렌더링
+- 백엔드: `NodeHandler.validate()` 와 AI assistant 의 `WORKFLOW_REVIEW_REQUIRED` 검토
+
+같은 규칙을 두 layer 가 공유해야 spec 변경 시 자동으로 정렬된다.
+
+## 빌드
+
+```bash
+npm run build
+npm run watch
+npm test
+```
+
+`backend` / `frontend` 가 workspace dep 로 import 하므로 두 앱 실행 전 build 가 선행되어야 한다.
+
+## 사용
+
+백엔드 (handler.validate):
+
+```ts
+import { evaluateWarnings } from '@workflow/node-summary';
+
+const errors = evaluateWarnings(config, this.metadata.warningRules)
+  .filter((w) => w.severity === 'blocking')
+  .map((w) => w.message);
+```
+
+프론트엔드 (canvas summary):
+
+```ts
+import {
+  evaluateWarnings,
+  renderSummaryTemplate,
+} from '@workflow/node-summary';
+
+const warnings = evaluateWarnings(config, def.metadata.warningRules);
+const blocking = warnings.find((w) => w.severity === 'blocking');
+if (blocking) return { text: `⚠ ${blocking.message}`, isWarning: true };
+
+return {
+  text: renderSummaryTemplate(def.metadata.summaryTemplate, config),
+  isWarning: false,
+};
+```
+
+## 주요 export
+
+| Symbol | 설명 |
+|--------|------|
+| `evaluateWarnings(config, rules)` | warningRules 평가 → `{ severity, message }[]` |
+| `renderSummaryTemplate(template, config)` | summaryTemplate 의 `${path}` placeholder 치환 |
+| `WarningRule` / `WarningSeverity` | 규칙·심각도 타입 |
+
+## boundary
+
+- 본 패키지는 `@workflow/expression-engine` 만 (필요한 경우) 참조하며 다른 `packages/*` 를 참조하지 않는다.
+- DOM / Node API 비의존 — 양쪽 런타임에서 동일하게 동작.

```

---

### 파일 25: plan/in-progress/20260516-full-review/RESOLUTION.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/plan/in-progress/20260516-full-review/RESOLUTION.md b/plan/in-progress/20260516-full-review/RESOLUTION.md
new file mode 100644
index 00000000..5bd66648
--- /dev/null
+++ b/plan/in-progress/20260516-full-review/RESOLUTION.md
@@ -0,0 +1,105 @@
+---
+worktree: full-review-fixes-a1b2c3
+started: 2026-05-16
+owner: developer
+---
+
+# Full-Review Resolution — 2026-05-16
+
+> 기준 보고서: `plan/in-progress/20260516-full-review/SUMMARY.md`
+> 작업 worktree: `.claude/worktrees/full-review-fixes-a1b2c3` / branch `claude/full-review-fixes-a1b2c3`
+> 사용자 요청: "우선순위가 높은 순서대로 의사결정이 필요 없는 부분을 순차적으로 경고 단계까지 모두 처리해줘"
+> 검증: 백엔드 단위 테스트 3,762/3,762 통과, `tsc --noEmit -p tsconfig.build.json` 통과
+
+본 문서는 위 SUMMARY 의 발견사항 중 "의사결정 불필요 + 위험도 Critical~Warning" 항목을 1회 작업으로 일괄 처리한 결과를 기록한다. 후속 의사결정이 필요한 항목과 deferred 항목은 마지막 두 절에서 명시한다.
+
+---
+
+## 처리 완료 (Critical)
+
+| # | 위치 | 변경 |
+|---|------|------|
+| C-5 | `backend/src/modules/execution-engine/execution-engine.service.ts:3637,3679,3735` | `planContainerBody` 안의 `allNodes.find()` 를 함수 도입부에서 1회 생성한 `nodeMap` 의 `nodeMap.get()` 호출로 전환. 동일 `nodeMap` 을 반환 plan 에 재사용해 중복 Map 생성 제거 |
+| C-7 | spec/*.md 11곳 | `11-mcp-client.md#23-internal-bridge` 깨진 앵커를 실제 헤딩(`### 2.3 Internal Bridge (in-process)`) 의 GFM slug `#23-internal-bridge-in-process` 로 일괄 치환 |
+| C-9 | `backend/migrations/V052__notification_type_integration_action_required.sql` (신규) | `notification.type` CHECK 제약에 `integration_action_required` 추가. `IntegrationActionRequiredNotifierService` INSERT 가 check_violation 으로 실패하던 결함 해소 |
+| C-11 (부분) | `backend/src/main.ts`, `backend/src/modules/hooks/hooks.service.spec.ts` | `NestFactory.create(AppModule, { rawBody: true })` 적용 (HMAC 서명 검증 활성화). HMAC + bearer 경로 단위 테스트 9건 추가 (length mismatch / equal-length mismatch / valid match / missing signature / missing rawBody / signature mismatch / valid sha256 / unsupported algorithm 등) |
+| C-13 | `backend/package.json` | `overrides` 에 `protobufjs ^7.5.6`, `fast-uri ^3.1.2` 추가. `npm audit` 결과 fast-uri/protobufjs 다중 CVE 해소 (잔여: hono via @modelcontextprotocol/sdk W-57, OTel breaking W-54/W-56 — deferred) |
+| C-14 | `spec/conventions/conversation-thread.md:3` | `[Spec AI 공통 §11](.../0-common.md#11-conversation-context)` → `[Spec AI 공통 §10](.../0-common.md#10-conversation-context-자동-컨텍스트-주입)`. 실제 헤딩 번호 10 과 동기화 |
+| C-15 | `spec/2-navigation/4-integration.md:951` | `[Spec Cafe24 API 메타데이터 §6](.../cafe24-api-metadata.md#6-allowlist-와의-관계)` → `§7` / `#7-allowlist-와의-관계`. 실제 헤딩 번호 7 과 동기화 |
+
+W-60 (V049 파일-디렉토리 충돌) 은 현 base 커밋(`3f5457aa`) 에 빈 V049 디렉토리가 존재하지 않아 별도 조치 없이 already-resolved 로 분류한다.
+
+---
+
+## 처리 완료 (Warning)
+
+| # | 위치 | 변경 |
+|---|------|------|
+| W-2 | `backend/src/modules/hooks/hooks.service.ts:18,159` | HMAC 알고리즘 허용 목록 `Set(['sha256','sha512'])` 신설. `verifyAuth` 안에서 외부 입력 algorithm 을 허용 목록 외 값일 때 `UnauthorizedException`. 단위 테스트 1건 추가 |
+| W-15 | `spec/5-system/10-graph-rag.md:236` | `graph_extraction_status` Enum 값에 `failed` 추가 + 부연 설명. §7/§3.2 의 영구 실패 분기와 자체 모순 해소 |
+| W-21 | `backend/src/modules/statistics/statistics.service.ts:80` | `getSummary` 의 unconditional 워크스페이스 집계 쿼리 + workflowId 별 재집계 패턴을 단일 QueryBuilder 로 통합. workflowId 가 있을 때만 `andWhere` 추가, 첫 쿼리 결과 폐기 제거 |
+| W-22 | `backend/src/modules/executions/executions.service.ts:20,127` | `executionPath` 조회에 `MAX_EXECUTION_PATH_ROWS=10000` 상한 (`take`). 대규모 ForEach 로그 행 메모리 적재량 안전망. 관련 spec 테스트 갱신 |
+| W-25 | `backend/src/modules/websocket/websocket.service.ts:92` | `sanitizePayloadForWs` 가 자식 mutation 없는 경우 원본 참조를 반환하도록 변경. GC pressure 감소 + emit hot path 의 객체 할당 제거 |
+| W-31 (5건) | `backend/src/modules/integrations/services/credentials-transformer.ts`, `backend/src/modules/integrations/integrations.service.ts:702`, `backend/src/modules/integrations/integration-oauth.service.ts:282,307`, `backend/src/nodes/presentation/table/table.handler.ts:264` | `console.warn` / `console.error` 5곳을 NestJS `Logger` 인스턴스로 교체. 모듈 수준 인스턴스가 필요한 곳은 `new Logger('<name>')` 로 import |
+| W-37 | `backend/src/modules/hooks/hooks.service.spec.ts` | `constantTimeEquals` 분기 (length mismatch / equal-length / 성공) 단위 테스트가 bearer + HMAC 시나리오로 9건 추가 (C-11 와 합쳐 한 번에 작성) |
+| W-41 | `backend/test/webhook-trigger.e2e-spec.ts:74,95,112,134` | `e2e-X-${Date.now()}` 4곳을 `crypto.randomBytes(8).toString('hex')` 기반으로 전환. 동시 e2e 실행 시 endpointPath 충돌 방지 |
+| W-46 | `backend/src/common/dto/pagination.dto.ts:11,53` | `PaginationQueryDto.sort` 에 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `@MaxLength(64)` 적용. 서비스별 `getSortColumn()` 화이트리스트를 보조하는 DTO 레벨 1차 차단 |
+| W-55 | `backend/package.json` | C-13 와 함께 `fast-uri` overrides 추가. `npm audit` GHSA-q3j6-qgpj-74h6 / GHSA-v39h-62p7-jpjc 해소 |
+| W-63 | `backend/migrations/V053__notification_workspace_type_resource_idx.{sql,conf}` (신규) | `notification(workspace_id, type, resource_id, created_at DESC)` 복합 인덱스를 `CONCURRENTLY` 로 추가. `NotificationsService.hasRecentByResource` idempotency 쿼리 hot path 인덱스 보강 |
+| W-68 | `backend/src/modules/websocket/websocket.gateway.ts:217` | `authorize()` await 경계 이후 `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 재검사 추가. 동시 subscribe 가 한도 검사를 interleave 하는 race 해소 |
+| W-69 | `spec/4-nodes/4-integration/4-cafe24.md:23,90` | `pagination` 필드의 `cursor?: string` 제거 + 사유 문구 추가. §3, §4.2 의 cursor 언급 동시 삭제 |
+| W-77 | `frontend/README.md:7` | `yarn dev` / `pnpm dev` / `bun dev` 명령 제거. 루트 CLAUDE.md "패키지 매니저" 규약(npm 전용) 과 정합 |
+| W-79 | `packages/expression-engine/README.md`, `packages/node-summary/README.md` (신규) | 두 패키지의 목적·빌드·사용·boundary 를 정리한 최소 README 작성 |
+| W-80 | `README.md:333` | h1 `# integration (SSO)` 을 h2 로 강등. 직속 자식 `## Google OAuth 연동 설정` 도 h3 로 동시 강등 |
+
+> 자료의 단일 진실 원칙 상, 본 표의 변경은 모두 동일 branch (`claude/full-review-fixes-a1b2c3`) 의 단일 작업 단위로 묶여 있다.
+
+---
+
+## 의사결정 보류 (사용자/스펙 합의 필요)
+
+| # | 사유 |
+|---|------|
+| C-1 / C-2 | Re-run 기능 백엔드·프론트엔드 완전 미구현. 신규 worktree 에서 `replay-rerun.md` PR2 단위로 별도 진행 필요 |
+| C-3 | AI Agent 일반 도구 연결 모델 결정 — 사용자 합의 필요 |
+| C-4 | `sanitizePayloadForWs` 설정 레이어 이동 — emit hot path 의 trust boundary 재설계 필요 (allowlist 정의가 의사결정 사안) |
+| C-6 | `ExecutionEngineService` God-Object 분해 — 4단계 분리안 (`AiConversationOrchestrator` 등) 별도 plan 으로 진행 |
+| C-8 | README 포트 혼재 — 환경별(host dev=3000 vs docker fullstack=3012) 매핑 정확도 확인이 필요 |
+| C-10 | `AuthConfig.config` 평문 → encryptedJsonTransformer + 평문 행 마이그레이션 스크립트 — 데이터 마이그레이션 절차 사용자 합의 필요 |
+| C-12 | Cafe24 OAu

... (truncated due to prompt size limit) ...

---

### 파일 26: spec/0-overview.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/0-overview.md b/spec/0-overview.md
index 1ca4744b..df296b11 100644
--- a/spec/0-overview.md
+++ b/spec/0-overview.md
@@ -98,7 +98,7 @@ Clemvion은 AI 에이전트와 노코드 워크플로우 빌더를 통합한 실
 | **마켓플레이스** | 워크플로우 템플릿·AI Agent 프리셋·Integration 플러그인·커스텀 노드 게시 기능. |
 | **배포 자동화 확장** | 공식 Docker/Kubernetes 배포 가이드, 셀프 호스팅 번들. |
 | **확장 SDK** | 노드 플러그인 SDK, 외부 커스텀 노드 개발/게시. |
-| **Internal MCP Bridge 패턴 확장** | Cafe24 (구현 완료, §6.2) 이후 Shopify·Naver Smartstore 등 first-party 이커머스 통합을 같은 [Spec MCP Client §2.3](./5-system/11-mcp-client.md#23-internal-bridge) 패턴으로 추가. |
+| **Internal MCP Bridge 패턴 확장** | Cafe24 (구현 완료, §6.2) 이후 Shopify·Naver Smartstore 등 first-party 이커머스 통합을 같은 [Spec MCP Client §2.3](./5-system/11-mcp-client.md#23-internal-bridge-in-process) 패턴으로 추가. |
 
 ---
 

```

---

### 파일 27: spec/1-data-model.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/1-data-model.md b/spec/1-data-model.md
index fdf95d1e..acec8308 100644
--- a/spec/1-data-model.md
+++ b/spec/1-data-model.md
@@ -244,7 +244,7 @@ Schedule은 Trigger의 서브타입이다. 양쪽의 라이프사이클과 상
 |------|------|------|
 | id | UUID | PK |
 | workspace_id | UUID | FK → Workspace |
-| service_type | String | 서비스 유형 (google, github, http, database, email, webhook, mcp, cafe24). `mcp` 의 사용처·credentials 스키마는 [Spec MCP Client](./5-system/11-mcp-client.md) · [Spec 통합 §5.6](./2-navigation/4-integration.md#56-mcp-server). `cafe24` 는 [Spec 통합 §5.8](./2-navigation/4-integration.md#58-cafe24) · [Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md) — 같은 Integration 이 워크플로 노드와 AI Agent MCP Bridge 양쪽에서 사용된다 ([Spec MCP Client §2.3 Internal Bridge](./5-system/11-mcp-client.md#23-internal-bridge)) |
+| service_type | String | 서비스 유형 (google, github, http, database, email, webhook, mcp, cafe24). `mcp` 의 사용처·credentials 스키마는 [Spec MCP Client](./5-system/11-mcp-client.md) · [Spec 통합 §5.6](./2-navigation/4-integration.md#56-mcp-server). `cafe24` 는 [Spec 통합 §5.8](./2-navigation/4-integration.md#58-cafe24) · [Spec Cafe24 노드](./4-nodes/4-integration/4-cafe24.md) — 같은 Integration 이 워크플로 노드와 AI Agent MCP Bridge 양쪽에서 사용된다 ([Spec MCP Client §2.3 Internal Bridge](./5-system/11-mcp-client.md#23-internal-bridge-in-process)) |
 | name | String | 사용자 지정 별칭 |
 | auth_type | Enum | oauth2 / api_key / bearer_token / basic / connection_string / smtp / webhook_outbound / none. `none` 은 인증이 없는 공용 MCP 서버 등에 사용 |
 | credentials | JSONB (encrypted) | 인증 정보 (암호화 저장). OAuth의 경우 `scopes: string[]` 포함 |

```

---

### 파일 28: spec/2-navigation/4-integration.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/2-navigation/4-integration.md b/spec/2-navigation/4-integration.md
index a99b15a1..446fe4bf 100644
--- a/spec/2-navigation/4-integration.md
+++ b/spec/2-navigation/4-integration.md
@@ -947,8 +947,8 @@ UI 배지 (사이드바 카운트 + 목록 카드 뱃지) 와 노드 에디터 
 ### 14.2 워크플로우 에디터
 
 - 노드 설정 패널에서 Integration 선택은 `IntegrationSelector` 공용 드롭다운을 사용한다 — `serviceTypes` prop으로 목록을 필터(Send Email은 `email`, Database는 `database`, HTTP의 `authentication='integration'` 모드는 `http`, Cafe24 노드는 `cafe24`, AI Agent 의 `mcpServers` 항목은 `['mcp', 'cafe24']`).
-- AI Agent 의 `mcpServers` 셀렉트는 `service_type='mcp'` 와 `service_type='cafe24'` 를 모두 받는다 — 후자는 backend `Cafe24McpBridge` 가 in-process `IMcpClient` 로 동작 ([Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge)). UI 는 두 그룹을 시각적으로 분리 표시 (`🌐 Generic MCP (HTTP) servers` / `🛒 Cafe24 stores (Internal Bridge)`).
-- AI Agent 노드는 Integration 노드와 달리 `mcpServers` 가 다중 선택 (multi-select) 이며, 서버별로 도구 allowlist·resource/prompt 노출 토글 UI 가 추가된다 — Cafe24 의 경우 도구 수가 많아(Resource × Operation = ~180) allowlist UI 가 카테고리 단위 grouping 으로 노출된다 (용어는 [Spec Cafe24 API 메타데이터 §6](../conventions/cafe24-api-metadata.md#6-allowlist-와의-관계) 기준; [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md), [Spec MCP Client §5.6](../5-system/11-mcp-client.md#56-도구-allowlist)).
+- AI Agent 의 `mcpServers` 셀렉트는 `service_type='mcp'` 와 `service_type='cafe24'` 를 모두 받는다 — 후자는 backend `Cafe24McpBridge` 가 in-process `IMcpClient` 로 동작 ([Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge-in-process)). UI 는 두 그룹을 시각적으로 분리 표시 (`🌐 Generic MCP (HTTP) servers` / `🛒 Cafe24 stores (Internal Bridge)`).
+- AI Agent 노드는 Integration 노드와 달리 `mcpServers` 가 다중 선택 (multi-select) 이며, 서버별로 도구 allowlist·resource/prompt 노출 토글 UI 가 추가된다 — Cafe24 의 경우 도구 수가 많아(Resource × Operation = ~180) allowlist UI 가 카테고리 단위 grouping 으로 노출된다 (용어는 [Spec Cafe24 API 메타데이터 §7](../conventions/cafe24-api-metadata.md#7-allowlist-와의-관계) 기준; [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md), [Spec MCP Client §5.6](../5-system/11-mcp-client.md#56-도구-allowlist)).
 - 연동 상태 배지를 함께 노출하며(§7.3), 해당 타입의 연동이 0건이면 `+ Create {Service} integration` CTA 링크를 select 아래에 표시(`/integrations/new?service=…&step=auth`).
 - 삭제된 integrationId가 저장돼 있으면 `{id앞8자}… (missing)` 옵션을 추가해 값 보존.
 

```

---

### 파일 29: spec/3-workflow-editor/4-ai-assistant.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/3-workflow-editor/4-ai-assistant.md b/spec/3-workflow-editor/4-ai-assistant.md
index 1a51dc80..a06e9a19 100644
--- a/spec/3-workflow-editor/4-ai-assistant.md
+++ b/spec/3-workflow-editor/4-ai-assistant.md
@@ -342,7 +342,7 @@ interface CandidateEntry {
 
 | widget | 조회 | 필터 |
 |--------|------|------|
-| `integration-selector` | `Integration` | `workspace_id` 일치 + `status='connected'`. 노드 스키마 meta 에 `integrationServiceType` 힌트가 있으면 해당 `service_type` 만 (string 단일값 또는 `string[]` 배열 — 배열이면 `service_type IN (...)` 쿼리), 없으면 전체 connected integration. AI Agent `mcpServers` widget 의 hint 는 `['mcp', 'cafe24']` ([Spec 통합 §14.2](../2-navigation/4-integration.md#142-워크플로우-에디터) — `serviceTypes` prop 화이트리스트의 single source of truth, Internal Bridge ([Spec MCP Client §2.3](../5-system/11-mcp-client.md#23-internal-bridge)) 적용 service_type 이 추가되면 동시 갱신). |
+| `integration-selector` | `Integration` | `workspace_id` 일치 + `status='connected'`. 노드 스키마 meta 에 `integrationServiceType` 힌트가 있으면 해당 `service_type` 만 (string 단일값 또는 `string[]` 배열 — 배열이면 `service_type IN (...)` 쿼리), 없으면 전체 connected integration. AI Agent `mcpServers` widget 의 hint 는 `['mcp', 'cafe24']` ([Spec 통합 §14.2](../2-navigation/4-integration.md#142-워크플로우-에디터) — `serviceTypes` prop 화이트리스트의 single source of truth, Internal Bridge ([Spec MCP Client §2.3](../5-system/11-mcp-client.md#23-internal-bridge-in-process)) 적용 service_type 이 추가되면 동시 갱신). |
 | `llm-config-selector` | `LlmConfig` | `workspace_id` 일치. 최근 업데이트 순. |
 | `kb-selector` | `KnowledgeBase` | `workspace_id` 일치. 이름 오름차순. |
 | `workflow-selector` | `Workflow` | 같은 `workspace_id` **&&** `id != session.workflow_id` (현재 편집 중 워크플로 제외). 최근 업데이트 순. |

```

---

### 파일 30: spec/4-nodes/3-ai/0-common.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/4-nodes/3-ai/0-common.md b/spec/4-nodes/3-ai/0-common.md
index 845777a1..d61419e4 100644
--- a/spec/4-nodes/3-ai/0-common.md
+++ b/spec/4-nodes/3-ai/0-common.md
@@ -35,7 +35,7 @@ KB 검색은 LLM 의 능동 호출 시에만 실행되며 prefill 하지 않는
 
 ## 3. MCP 서버 연결 (AI Agent 전용)
 
-AI Agent 노드는 워크스페이스에 등록된 MCP-capable Integration 을 다중 선택해 도구로 사용한다. MCP-capable 의 범주에는 외부 MCP 서버 (`service_type='mcp'`) 와 backend in-process Internal Bridge 가 노출하는 Integration (`service_type='cafe24'`, 향후 확장 가능)이 모두 포함된다 — [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge) 참조.
+AI Agent 노드는 워크스페이스에 등록된 MCP-capable Integration 을 다중 선택해 도구로 사용한다. MCP-capable 의 범주에는 외부 MCP 서버 (`service_type='mcp'`) 와 backend in-process Internal Bridge 가 노출하는 Integration (`service_type='cafe24'`, 향후 확장 가능)이 모두 포함된다 — [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) 참조.
 
 | 필드 | 타입 | 설명 |
 |------|------|------|

```

---

### 파일 31: spec/4-nodes/3-ai/1-ai-agent.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/4-nodes/3-ai/1-ai-agent.md b/spec/4-nodes/3-ai/1-ai-agent.md
index 2cd114c0..ae3820c2 100644
--- a/spec/4-nodes/3-ai/1-ai-agent.md
+++ b/spec/4-nodes/3-ai/1-ai-agent.md
@@ -22,7 +22,7 @@ LLM 기반 AI Agent를 실행. 프롬프트, RAG, Tool Use를 지원. **Single T
 | knowledgeBases | UUID[] | | `[]` | 참조할 Knowledge Base ID 목록. [공통 §2](./0-common.md#2-knowledge-base-연동) |
 | ragTopK | Integer | | `5` | KB tool 호출 시 반환할 청크 수의 기본값 (LLM 이 호출 인자로 override 가능) |
 | ragThreshold | Float | | `0.7` | 최소 유사도 임계값 (0-1) 의 기본값 (LLM 이 호출 인자로 override 가능) |
-| mcpServers | McpServerRef[] | | `[]` | MCP-capable Integration 참조 목록. `service_type ∈ ('mcp', 'cafe24')` 모두 수용 — 후자는 backend `Cafe24McpBridge` 가 in-process `IMcpClient` 로 동작 ([Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge)). [공통 §3](./0-common.md#3-mcp-서버-연결-ai-agent-전용) |
+| mcpServers | McpServerRef[] | | `[]` | MCP-capable Integration 참조 목록. `service_type ∈ ('mcp', 'cafe24')` 모두 수용 — 후자는 backend `Cafe24McpBridge` 가 in-process `IMcpClient` 로 동작 ([Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process)). [공통 §3](./0-common.md#3-mcp-서버-연결-ai-agent-전용) |
 | maxToolCalls | Integer | ✓ | `10` | 최대 도구 호출 횟수 (KB·MCP·일반 합산) |
 | contextScope | `none` / `thread` / `lastN` | ✓ | `none` | 자동 주입할 thread 범위. [공통 §10](./0-common.md#10-conversation-context-자동-컨텍스트-주입) |
 | contextScopeN | Integer | | `20` | `lastN` 시 최근 N개 turn |

```

---

### 파일 32: spec/4-nodes/4-integration/0-common.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/4-nodes/4-integration/0-common.md b/spec/4-nodes/4-integration/0-common.md
index 1547cacd..7a2ca518 100644
--- a/spec/4-nodes/4-integration/0-common.md
+++ b/spec/4-nodes/4-integration/0-common.md
@@ -125,4 +125,4 @@ Integration 노드는 모두 [CONVENTIONS Principle 0](../../conventions/node-ou
 | 일자 | 변경 |
 |------|------|
 | 2026-05-10 | §6 5필드 공통 규약 / §7 출력 구조 색인 신설. 노드 문서 §5 출력 구조 5필드 모델로 정합화 (Principle 0~11 적용). `http_request.meta.duration` → `meta.durationMs` 통일 (Breaking, P0). 기존 §1~§5 anchor 보존 |
-| 2026-05-13 | 도입부 scope note 에 `cafe24` 캔버스 노드 추가 + 진입 링크. §5 캔버스 요약 표 / §7 출력 색인에 cafe24 행 추가. Integration 엔티티의 "캔버스 노드 + AI Agent MCP 도구" 첫 동시 사용 사례 ([Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge)). cafe24 노드는 5필드 invariant + Principle 7 config echo 그대로 채택 ([4-cafe24.md §5](./4-cafe24.md#5-출력-구조)) |
+| 2026-05-13 | 도입부 scope note 에 `cafe24` 캔버스 노드 추가 + 진입 링크. §5 캔버스 요약 표 / §7 출력 색인에 cafe24 행 추가. Integration 엔티티의 "캔버스 노드 + AI Agent MCP 도구" 첫 동시 사용 사례 ([Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process)). cafe24 노드는 5필드 invariant + Principle 7 config echo 그대로 채택 ([4-cafe24.md §5](./4-cafe24.md#5-출력-구조)) |

```

---

### 파일 33: spec/4-nodes/4-integration/4-cafe24.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/4-nodes/4-integration/4-cafe24.md b/spec/4-nodes/4-integration/4-cafe24.md
index 705fb6d3..28e416d8 100644
--- a/spec/4-nodes/4-integration/4-cafe24.md
+++ b/spec/4-nodes/4-integration/4-cafe24.md
@@ -1,6 +1,6 @@
 # Spec: Cafe24
 
-> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [Spec 통합 §5.8 Cafe24](../../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge) · [CONVENTIONS](../../conventions/node-output.md) · [Cafe24 API Metadata 컨벤션](../../conventions/cafe24-api-metadata.md) · [Cafe24 API Catalog](../../conventions/cafe24-api-catalog/_overview.md)
+> 관련 문서: [Integration 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진 §10](../../5-system/4-execution-engine.md#10-integration-handler-계약) · [Spec 통합 §5.8 Cafe24](../../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) · [CONVENTIONS](../../conventions/node-output.md) · [Cafe24 API Metadata 컨벤션](../../conventions/cafe24-api-metadata.md) · [Cafe24 API Catalog](../../conventions/cafe24-api-catalog/_overview.md)
 
 ## Overview (제품 정의)
 
@@ -8,7 +8,7 @@
 
 - **사용자 가치**: 쇼핑몰 운영자가 상품·주문·회원·프로모션 등 모든 Admin API endpoint 를 워크플로 노드 1개로 호출 가능. 동시에 AI Agent 에 같은 Integration 을 도구로 부여하면 LLM 이 자연어로 "어제 미발송 주문 가져와줘" 같은 작업을 수행한다.
 - **지원 범위**: Cafe24 Admin API 의 **18 카테고리 전부 (Store / Product / Order / Customer / Community / Design / Promotion / Application / Category / Collection / Supply / Shipping / Salesreport / Personal / Privacy / Mileage / Notification / Translation)**. 카테고리당 평균 ~10 operation = 총 ~180 endpoint 를 메타데이터 기반 동적 폼으로 표현한다.
-- **이중 활용**: Cafe24 는 본 프로젝트에서 "같은 Integration 1개가 워크플로 캔버스 노드와 AI Agent MCP 도구 양쪽에 동시 노출되는" 첫 사례다. backend 의 `Cafe24McpBridge` 가 [Spec MCP Client §2.3](../../5-system/11-mcp-client.md#23-internal-bridge) 의 in-process `IMcpClient` 인터페이스를 구현하여 본 노드와 같은 메타데이터 테이블에서 MCP `tools/list` 응답을 생성한다.
+- **이중 활용**: Cafe24 는 본 프로젝트에서 "같은 Integration 1개가 워크플로 캔버스 노드와 AI Agent MCP 도구 양쪽에 동시 노출되는" 첫 사례다. backend 의 `Cafe24McpBridge` 가 [Spec MCP Client §2.3](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) 의 in-process `IMcpClient` 인터페이스를 구현하여 본 노드와 같은 메타데이터 테이블에서 MCP `tools/list` 응답을 생성한다.
 
 ---
 
@@ -20,7 +20,7 @@
 | resource | Enum | ✓ | — | Cafe24 카테고리. 18 값: `store`, `product`, `order`, `customer`, `community`, `design`, `promotion`, `application` (**※ Cafe24 앱 관리 API — OAuth 앱 등록과 무관**), `category`, `collection`, `supply`, `shipping`, `salesreport`, `personal`, `privacy`, `mileage`, `notification`, `translation` |
 | operation | String | ✓ | — | 선택한 `resource` 의 operation 식별자. 메타데이터 테이블 ([cafe24-api-metadata 컨벤션](../../conventions/cafe24-api-metadata.md))에 정의된 enum 중 하나 (예: `product_list`, `product_get`, `order_list`, `order_update_status`, ...) |
 | fields | Record<string, unknown> | — | `{}` | 선택한 operation 의 입력 필드. 표현식 `{{ }}` 사용 가능. 각 operation 의 required/optional 필드는 메타데이터 테이블에서 정의 |
-| pagination | object? | — | — | `{ limit?: number, offset?: number, cursor?: string }`. operation 이 페이지네이션을 지원하는 경우에만 사용. fields 와 분리해 표준화 |
+| pagination | object? | — | — | `{ limit?: number, offset?: number }`. operation 이 페이지네이션을 지원하는 경우에만 사용. fields 와 분리해 표준화. `cursor` 는 Cafe24 Admin API 가 일관 지원하지 않아 폐기됨 (B-3-7, Rationale 참조) |
 
 표현식(`{{ }}`)은 `fields[*]` · `pagination.*` 모든 값에서 사용 가능.
 
@@ -87,7 +87,7 @@
 5. **Required fields 검증**: 메타데이터의 `requiredFields` 에 명시된 키가 `config.fields` 에 모두 존재하는지 검증. 누락 시 throw `CAFE24_MISSING_FIELDS` (어느 필드인지 details 에 명시).
 6. **토큰 만료 확인 및 갱신**: `Integration.token_expires_at` 가 만료됐거나 60초 내 만료 예정이면 자동 갱신 ([§통합 §10.5 토큰 자동 갱신](../../2-navigation/4-integration.md#105-토큰-자동-갱신)). 갱신 실패 시: `refresh_token invalid_grant` 면 `error(auth_failed)` 로 전이 (옛 `expired` 분기 폐기 — 2026-05-16, [통합 §6 / Rationale "refresh 실패 시 status_reason 통일"](../../2-navigation/4-integration.md#rationale)), transport 3회 연속 실패면 `error(network)` 로 전이. throw `INTEGRATION_NOT_CONNECTED` 는 동일. 또한 모든 cafe24 refresh 호출은 `cafe24-token-refresh` BullMQ 큐의 `jobId = integrationId` dedup 으로 클러스터 전체 직렬화된다 (§9.6 참고).
 7. **URL 구성**: `https://{credentials.mall_id}.cafe24api.com/api/v2/admin/{operation.path}` — `{path}` 는 메타데이터에 정의된 path template (예: `products/{product_no}`). path parameter 는 `fields` 에서 채움.
-8. **Query / Body 구성**: 메타데이터의 `fields[*].location` (path / query / body) 에 따라 분배. `pagination.{limit, offset, cursor}` 는 항상 query. body 의 envelope 직렬화는 step 9 의 wrapper 가 단일 책임으로 담당한다 (§4.2 참고).
+8. **Query / Body 구성**: 메타데이터의 `fields[*].location` (path / query / body) 에 따라 분배. `pagination.{limit, offset}` 는 항상 query. body 의 envelope 직렬화는 step 9 의 wrapper 가 단일 책임으로 담당한다 (§4.2 참고).
 9. **호출 (rate-limit-aware)**: `Cafe24ApiClient` wrapper 가 다음을 수행 — `Authorization: Bearer {access_token}` 헤더 부여 → POST/PUT 본문은 Cafe24 request envelope 으로 wrap (§4.2) → fetch → 응답 헤더 `X-Cafe24-Call-Remain` 모니터링 → 429 응답 시 헤더 값(초) 만큼 sleep 후 재시도(최대 2회).
 10. **응답 파싱**: JSON 본문을 그대로 `output.response` 에 보존. `meta.statusCode`, `meta.durationMs`, `meta.callUsage` (헤더 `X-Cafe24-Call-Usage`), `meta.callRemain` (헤더 `X-Cafe24-Call-Remain`).
 11. **Usage 로깅** ([공통 §4 의 6단계 Usage 로깅](./0-common.md#4-handler-실행-세멘틱)): 성공·실패 무관 1건. `error.code` 는 §6 의 vocabulary.
@@ -334,7 +334,7 @@ Pre-flight throw 코드는 §5.8 참조 — `output.error.code` 가 아니라 
 
 ## 8. AI Agent 노출 (Internal MCP Bridge)
 
-`Integration` 1개가 본 노드와 AI Agent 의 MCP 도구 양쪽에서 사용된다. 백엔드의 `Cafe24McpBridge` 가 [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge) 의 in-process `IMcpClient` 인터페이스를 구현하여 본 노드와 동일한 메타데이터 테이블로부터 MCP `tools/list` 응답을 자동 생성한다.
+`Integration` 1개가 본 노드와 AI Agent 의 MCP 도구 양쪽에서 사용된다. 백엔드의 `Cafe24McpBridge` 가 [Spec MCP Client §2.3 Internal Bridge](../../5-system/11-mcp-client.md#23-internal-bridge-in-process) 의 in-process `IMcpClient` 인터페이스를 구현하여 본 노드와 동일한 메타데이터 테이블로부터 MCP `tools/list` 응답을 자동 생성한다.
 
 ### 8.1 도구 이름 매핑
 

```

---

### 파일 34: spec/5-system/10-graph-rag.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/5-system/10-graph-rag.md b/spec/5-system/10-graph-rag.md
index 513fb7fa..d82e0030 100644
--- a/spec/5-system/10-graph-rag.md
+++ b/spec/5-system/10-graph-rag.md
@@ -233,7 +233,7 @@ WebSocket 알림 (KB 상세 실시간 갱신)
 
 | 필드 | 타입 | 설명 |
 |------|------|------|
-| `graph_extraction_status` | Enum | pending / processing / completed / error. `vector` 모드 KB 에서는 항상 `pending` 으로 두고 사용하지 않음 |
+| `graph_extraction_status` | Enum | pending / processing / completed / error / failed. `vector` 모드 KB 에서는 항상 `pending` 으로 두고 사용하지 않음. `failed` 는 재시도 소진 후 영구 실패 상태 (§7 / §3.2 의 에러 처리 흐름 참조) |
 
 ### 2.3 Entity (신규)
 

```

---

### 파일 35: spec/conventions/cafe24-api-metadata.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/conventions/cafe24-api-metadata.md b/spec/conventions/cafe24-api-metadata.md
index 4023c18c..ea9b76b2 100644
--- a/spec/conventions/cafe24-api-metadata.md
+++ b/spec/conventions/cafe24-api-metadata.md
@@ -1,6 +1,6 @@
 # CONVENTION: Cafe24 API Metadata
 
-> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md)
+> 관련 문서: [Spec Cafe24 노드](../4-nodes/4-integration/4-cafe24.md) · [Spec 통합 §5.8 Cafe24](../2-navigation/4-integration.md#58-cafe24) · [Spec MCP Client §2.3 Internal Bridge](../5-system/11-mcp-client.md#23-internal-bridge-in-process) · [Cafe24 API Catalog](./cafe24-api-catalog/_overview.md)
 
 본 컨벤션은 Cafe24 Admin API 의 endpoint 매핑 메타데이터 **형식** 을 정의한다. 실제 endpoint 의 전수 카탈로그(supported/planned/deprecated)는 [`cafe24-api-catalog/`](./cafe24-api-catalog/_overview.md) 에 있고, backend 메타데이터 row 와 카탈로그는 `catalog-sync.spec.ts` 로 양방향 동기 보호된다.
 

```

---

### 파일 36: spec/conventions/conversation-thread.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
commit 13d21fcd5958bd092daf3d54dabd2b40f5a6d793
Author: worker-ants <admin@getit.co.kr>
Date:   Sat May 16 23:35:17 2026 +0900

    fix(review): full-review Critical 7건 + Warning 15건 일괄 조치
    
    `plan/in-progress/20260516-full-review/SUMMARY.md` 의 의사결정 불필요한
    Critical~Warning 항목을 일괄 처리한다. 결정 사안은 RESOLUTION.md 의
    "의사결정 보류" 절에 명시.
    
    Critical:
    - C-5: planContainerBody 의 allNodes.find() → nodeMap.get() (O(N)→O(1))
    - C-7: spec/*.md 11곳의 깨진 mcp-client §2.3 앵커 일괄 동기화
    - C-9: V052 — notification.type CHECK 에 integration_action_required 추가
    - C-11: NestFactory rawBody:true 활성화 + HMAC/bearer 단위 테스트 9건
    - C-13: protobufjs/fast-uri overrides (npm audit CVE 해소)
    - C-14/C-15: 0-common §10, cafe24-api-metadata §7 앵커 동기화
    
    Warning:
    - W-2: HMAC algorithm 허용 목록 (sha256/sha512)
    - W-15: graph_extraction_status Enum 에 failed 추가
    - W-21: statistics.getSummary 중복 쿼리 통합
    - W-22: executionPath 조회에 MAX_EXECUTION_PATH_ROWS 상한
    - W-25: sanitizePayloadForWs 가 unchanged 시 원본 참조 반환
    - W-31: console.warn/error 5곳을 NestJS Logger 로 교체
    - W-37: HooksService.constantTimeEquals 분기 단위 테스트
    - W-41: webhook e2e Date.now → crypto.randomBytes(8).toString('hex')
    - W-46: PaginationQueryDto.sort 식별자 패턴 검증
    - W-63: V053 — notification(workspace_id,type,resource_id,created_at) idx
    - W-68: WS handleSubscribe 의 await 이후 MAX_SUBSCRIPTIONS 재검사
    - W-69: Cafe24 spec §1/§4.2 cursor 흔적 제거
    - W-77: frontend README yarn/pnpm/bun 명령 제거 (npm 전용)
    - W-79: packages/{expression-engine,node-summary}/README.md 신설
    - W-80: README "# integration (SSO)" h1 → h2
    
    검증: tsc --noEmit -p tsconfig.build.json 통과, jest 210/210 suites
    3,762/3,762 tests 통과.
    
    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

diff --git a/spec/conventions/conversation-thread.md b/spec/conventions/conversation-thread.md
index 2e17c9aa..c56eae74 100644
--- a/spec/conventions/conversation-thread.md
+++ b/spec/conventions/conversation-thread.md
@@ -1,6 +1,6 @@
 # Conversation Thread (대화 스레드)
 
-> 관련 문서: [Spec 실행 엔진 §6.1](../5-system/4-execution-engine.md#61-컨텍스트-구조) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec AI 공통 §11](../4-nodes/3-ai/0-common.md#11-conversation-context) · [CONVENTIONS Principle 4.5](./node-output.md#45-interactiondata-payload-규격) · [Spec 표현식 언어 §4.4](../5-system/5-expression-language.md#44-thread-속성)
+> 관련 문서: [Spec 실행 엔진 §6.1](../5-system/4-execution-engine.md#61-컨텍스트-구조) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec AI 공통 §10](../4-nodes/3-ai/0-common.md#10-conversation-context-자동-컨텍스트-주입) · [CONVENTIONS Principle 4.5](./node-output.md#45-interactiondata-payload-규격) · [Spec 표현식 언어 §4.4](../5-system/5-expression-language.md#44-thread-속성)
 
 워크플로우 한 실행 동안 발생하는 사용자 인터랙션과 AI 대화 turn 을 시간순으로 누적하는 1급 컨텍스트. AI Agent 노드가 노드 설정 (`contextScope`) 으로 자동 주입받는다.
 

```
