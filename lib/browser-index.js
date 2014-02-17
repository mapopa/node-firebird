(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process,Buffer){
var
	net = require("net"),
    os = require("os"),
    serialize = require("./serialize.js"),
    XdrReader = serialize.XdrReader,
    BlrReader = serialize.BlrReader,
    XdrWriter = serialize.XdrWriter,
    BlrWriter = serialize.BlrWriter,
    messages = require("./messages.js");


const
    op_void				= 0,	// Packet has been voided
    op_connect			= 1,	// Connect to remote server
    op_exit				= 2,	// Remote end has exitted
    op_accept			= 3,	// Server accepts connection
    op_reject			= 4,	// Server rejects connection
    op_disconnect		= 6,	// Connect is going away
    op_response			= 9,	// Generic response block

// Full context server operations

    op_attach			= 19,	// Attach database
    op_create			= 20,	// Create database
    op_detach			= 21,	// Detach database
    op_compile			= 22,	// Request based operations
    op_start			= 23,
    op_start_and_send	= 24,
    op_send				= 25,
    op_receive			= 26,
    op_unwind			= 27,	// apparently unused, see protocol.cpp's case op_unwind
    op_release			= 28,

    op_transaction		= 29,	// Transaction operations
    op_commit			= 30,
    op_rollback			= 31,
    op_prepare			= 32,
    op_reconnect		= 33,

    op_create_blob		= 34,	// Blob operations
    op_open_blob		= 35,
    op_get_segment		= 36,
    op_put_segment		= 37,
    op_cancel_blob		= 38,
    op_close_blob		= 39,

    op_info_database	= 40,	// Information services
    op_info_request		= 41,
    op_info_transaction	= 42,
    op_info_blob		= 43,

    op_batch_segments	= 44,	// Put a bunch of blob segments

    op_que_events		= 48,	// Que event notification request
    op_cancel_events	= 49,	// Cancel event notification request
    op_commit_retaining	= 50,	// Commit retaining (what else)
    op_prepare2			= 51,	// Message form of prepare
    op_event			= 52,	// Completed event request (asynchronous)
    op_connect_request	= 53,	// Request to establish connection
    op_aux_connect		= 54,	// Establish auxiliary connection
    op_ddl				= 55,	// DDL call
    op_open_blob2		= 56,
    op_create_blob2		= 57,
    op_get_slice		= 58,
    op_put_slice		= 59,
    op_slice			= 60,	// Successful response to op_get_slice
    op_seek_blob		= 61,	// Blob seek operation

// DSQL operations

    op_allocate_statement	= 62,	// allocate a statment handle
    op_execute				= 63,	// execute a prepared statement
    op_exec_immediate		= 64,	// execute a statement
    op_fetch				= 65,	// fetch a record
    op_fetch_response		= 66,	// response for record fetch
    op_free_statement		= 67,	// free a statement
    op_prepare_statement	= 68,	// prepare a statement
    op_set_cursor			= 69,	// set a cursor name
    op_info_sql				= 70,

    op_dummy				= 71,	// dummy packet to detect loss of client
    op_response_piggyback	= 72,	// response block for piggybacked messages
    op_start_and_receive	= 73,
    op_start_send_and_receive	= 74,
    op_exec_immediate2		= 75,	// execute an immediate statement with msgs
    op_execute2				= 76,	// execute a statement with msgs
    op_insert				= 77,
    op_sql_response			= 78,	// response from execute, exec immed, insert
    op_transact				= 79,
    op_transact_response	= 80,
    op_drop_database		= 81,
    op_service_attach		= 82,
    op_service_detach		= 83,
    op_service_info			= 84,
    op_service_start		= 85,
    op_rollback_retaining	= 86,
    op_partial				= 89,	// packet is not complete - delay processing
    op_trusted_auth			= 90,
    op_cancel				= 91,
    op_cont_auth			= 92,
    op_ping					= 93,
    op_accept_data			= 94,	// Server accepts connection and returns some data to client
    op_abort_aux_connection	= 95,	// Async operation - stop waiting for async connection to arrive
    op_crypt				= 96;

const
    CONNECT_VERSION2	= 2;
    ARCHITECTURE_GENERIC = 1;

const
// Protocol 10 includes support for warnings and removes the requirement for
// encoding and decoding status codes
    PROTOCOL_VERSION10	= 10,

// Since protocol 11 we must be separated from Borland Interbase.
// Therefore always set highmost bit in protocol version to 1.
// For unsigned protocol version this does not break version's compare.

    FB_PROTOCOL_FLAG = 0x8000,

// Protocol 11 has support for user authentication related
// operations (op_update_account_info, op_authenticate_user and
// op_trusted_auth). When specific operation is not supported,
// we say "sorry".

    PROTOCOL_VERSION11	= (FB_PROTOCOL_FLAG | 11),

// Protocol 12 has support for asynchronous call op_cancel.
// Currently implemented asynchronously only for TCP/IP.

    PROTOCOL_VERSION12	= (FB_PROTOCOL_FLAG | 12),

// Protocol 13 has support for authentication plugins (op_cont_auth).

    PROTOCOL_VERSION13	= (FB_PROTOCOL_FLAG | 13);


const
    DSQL_close      = 1,
    DSQL_drop       = 2,
    DSQL_unprepare  = 4; // >= 2.5

const
    ptype_batch_send = 3;

const
    SQL_TEXT = 452, // Array of char
    SQL_VARYING = 448,
    SQL_SHORT = 500,
    SQL_LONG = 496,
    SQL_FLOAT = 482,
    SQL_DOUBLE = 480,
    SQL_D_FLOAT = 530,
    SQL_TIMESTAMP = 510,
    SQL_BLOB = 520,
    SQL_ARRAY = 540,
    SQL_QUAD = 550,
    SQL_TYPE_TIME = 560,
    SQL_TYPE_DATE = 570,
    SQL_INT64 = 580,
    SQL_BOOLEAN = 32764, // >= 3.0
    SQL_NULL = 32766; // >= 2.5

/***********************/
/*   ISC Error Codes   */
/***********************/
const
    isc_arg_end			= 0,	// end of argument list
    isc_arg_gds			= 1,	// generic DSRI status value
    isc_arg_string		= 2,	// string argument
    isc_arg_cstring		= 3,	// count & string argument
    isc_arg_number		= 4,	// numeric argument (long)
    isc_arg_interpreted	= 5,	// interpreted status code (string)
    isc_arg_vms			= 6,	// VAX/VMS status code (long)
    isc_arg_unix		= 7,	// UNIX error code
    isc_arg_domain		= 8,	// Apollo/Domain error code
    isc_arg_dos			= 9,	// MSDOS/OS2 error code
    isc_arg_mpexl		= 10,	// HP MPE/XL error code
    isc_arg_mpexl_ipc	= 11,	// HP MPE/XL IPC error code
    isc_arg_next_mach	= 15,	// NeXT/Mach error code
    isc_arg_netware		= 16,	// NetWare error code
    isc_arg_win32		= 17,	// Win32 error code
    isc_arg_warning		= 18,	// warning argument
    isc_arg_sql_state	= 19;	// SQLSTATE

const
    isc_sqlerr = 335544436;

/**********************************/
/* Database parameter block stuff */
/**********************************/
const
    isc_dpb_version1                = 1,
    isc_dpb_version2                = 2, // >= FB30
    isc_dpb_cdd_pathname            = 1,
    isc_dpb_allocation              = 2,
    isc_dpb_journal                 = 3,
    isc_dpb_page_size               = 4,
    isc_dpb_num_buffers             = 5,
    isc_dpb_buffer_length           = 6,
    isc_dpb_debug                   = 7,
    isc_dpb_garbage_collect         = 8,
    isc_dpb_verify                  = 9,
    isc_dpb_sweep                   = 10,
    isc_dpb_enable_journal          = 11,
    isc_dpb_disable_journal         = 12,
    isc_dpb_dbkey_scope             = 13,
    isc_dpb_number_of_users         = 14,
    isc_dpb_trace                   = 15,
    isc_dpb_no_garbage_collect      = 16,
    isc_dpb_damaged                 = 17,
    isc_dpb_license                 = 18,
    isc_dpb_sys_user_name           = 19,
    isc_dpb_encrypt_key             = 20,
    isc_dpb_activate_shadow         = 21,
    isc_dpb_sweep_interval          = 22,
    isc_dpb_delete_shadow           = 23,
    isc_dpb_force_write             = 24,
    isc_dpb_begin_log               = 25,
    isc_dpb_quit_log                = 26,
    isc_dpb_no_reserve              = 27,
    isc_dpb_user_name               = 28,
    isc_dpb_password                = 29,
    isc_dpb_password_enc            = 30,
    isc_dpb_sys_user_name_enc       = 31,
    isc_dpb_interp                  = 32,
    isc_dpb_online_dump             = 33,
    isc_dpb_old_file_size           = 34,
    isc_dpb_old_num_files           = 35,
    isc_dpb_old_file                = 36,
    isc_dpb_old_start_page          = 37,
    isc_dpb_old_start_seqno         = 38,
    isc_dpb_old_start_file          = 39,
    isc_dpb_drop_walfile            = 40,
    isc_dpb_old_dump_id             = 41,
    isc_dpb_wal_backup_dir          = 42,
    isc_dpb_wal_chkptlen            = 43,
    isc_dpb_wal_numbufs             = 44,
    isc_dpb_wal_bufsize             = 45,
    isc_dpb_wal_grp_cmt_wait        = 46,
    isc_dpb_lc_messages             = 47,
    isc_dpb_lc_ctype                = 48,
    isc_dpb_cache_manager           = 49,
    isc_dpb_shutdown                = 50,
    isc_dpb_online                  = 51,
    isc_dpb_shutdown_delay          = 52,
    isc_dpb_reserved                = 53,
    isc_dpb_overwrite               = 54,
    isc_dpb_sec_attach              = 55,
    isc_dpb_disable_wal             = 56,
    isc_dpb_connect_timeout         = 57,
    isc_dpb_dummy_packet_interval   = 58,
    isc_dpb_gbak_attach             = 59,
    isc_dpb_sql_role_name           = 60,
    isc_dpb_set_page_buffers        = 61,
    isc_dpb_working_directory       = 62,
    isc_dpb_sql_dialect             = 63,
    isc_dpb_set_db_readonly         = 64,
    isc_dpb_set_db_sql_dialect      = 65,
    isc_dpb_gfix_attach             = 66,
    isc_dpb_gstat_attach            = 67,
    isc_dpb_set_db_charset          = 68,
    isc_dpb_gsec_attach             = 69,
    isc_dpb_address_path            = 70,
    isc_dpb_process_id              = 71,
    isc_dpb_no_db_triggers          = 72,
    isc_dpb_trusted_auth			= 73,
    isc_dpb_process_name            = 74,
    isc_dpb_trusted_role			= 75,
    isc_dpb_org_filename			= 76,
    isc_dpb_utf8_filename			= 77,
    isc_dpb_ext_call_depth			= 78;

/*************************************/
/* Transaction parameter block stuff */
/*************************************/
const
    isc_tpb_version1                =  1,
    isc_tpb_version3                =  3,
    isc_tpb_consistency             =  1,
    isc_tpb_concurrency             =  2,
    isc_tpb_shared                  =  3, // < FB21
    isc_tpb_protected               =  4, // < FB21
    isc_tpb_exclusive               =  5, // < FB21
    isc_tpb_wait                    =  6,
    isc_tpb_nowait                  =  7,
    isc_tpb_read                    =  8,
    isc_tpb_write                   =  9,
    isc_tpb_lock_read               =  10,
    isc_tpb_lock_write              =  11,
    isc_tpb_verb_time               =  12,
    isc_tpb_commit_time             =  13,
    isc_tpb_ignore_limbo            =  14,
    isc_tpb_read_committed	        =  15,
    isc_tpb_autocommit              =  16,
    isc_tpb_rec_version             =  17,
    isc_tpb_no_rec_version          =  18,
    isc_tpb_restart_requests        =  19,
    isc_tpb_no_auto_undo            =  20,
    isc_tpb_lock_timeout            =  21; // >= FB20

/****************************/
/* Common, structural codes */
/****************************/
const
    isc_info_end = 1,
    isc_info_truncated = 2,
    isc_info_error = 3,
    isc_info_data_not_ready = 4,
    isc_info_length = 126,
    isc_info_flag_end = 127;

/*************************/
/* SQL information items */
/*************************/
const
    isc_info_sql_select = 4,
    isc_info_sql_bind = 5,
    isc_info_sql_num_variables = 6,
    isc_info_sql_describe_vars = 7,
    isc_info_sql_describe_end = 8,
    isc_info_sql_sqlda_seq = 9,
    isc_info_sql_message_seq = 10,
    isc_info_sql_type = 11,
    isc_info_sql_sub_type = 12,
    isc_info_sql_scale = 13,
    isc_info_sql_length = 14,
    isc_info_sql_null_ind = 15,
    isc_info_sql_field = 16,
    isc_info_sql_relation = 17,
    isc_info_sql_owner = 18,
    isc_info_sql_alias = 19,
    isc_info_sql_sqlda_start = 20,
    isc_info_sql_stmt_type = 21,
    isc_info_sql_get_plan = 22,
    isc_info_sql_records = 23,
    isc_info_sql_batch_fetch = 24,
    isc_info_sql_relation_alias = 25, // >= 2.0
    isc_info_sql_explain_plan = 26;   // >= 3.0

/*******************/
/* Blr definitions */
/*******************/
const
    blr_text = 14,
    blr_text2 = 15, /* added in 3.2 JPN */
    blr_short = 7,
    blr_long = 8,
    blr_quad = 9,
    blr_float = 10,
    blr_double = 27,
    blr_d_float = 11,
    blr_timestamp = 35,
    blr_varying = 37,
    blr_varying2 = 38,
    blr_blob = 261,
    blr_cstring = 40,
    blr_cstring2 = 41,
    blr_blob_id = 45,
    blr_sql_date = 12,
    blr_sql_time = 13,
    blr_int64 = 16,
    blr_blob2 = 17, // >= 2.0
    blr_domain_name = 18, // >= 2.1
    blr_domain_name2 = 19, // >= 2.1
    blr_not_nullable = 20, // >= 2.1
    blr_column_name = 21, // >= 2.5
    blr_column_name2 = 22, // >= 2.5
    blr_bool = 23, // >= 3.0

    blr_version4 = 4,
    blr_version5 = 5, // dialect 3
    blr_eoc = 76,
    blr_end = 255,

    blr_assignment = 1,
    blr_begin = 2,
    blr_dcl_variable = 3,
    blr_message = 4;

const
    isc_info_sql_stmt_select = 1,
    isc_info_sql_stmt_insert = 2,
    isc_info_sql_stmt_update = 3,
    isc_info_sql_stmt_delete = 4,
    isc_info_sql_stmt_ddl = 5,
    isc_info_sql_stmt_get_segment = 6,
    isc_info_sql_stmt_put_segment = 7,
    isc_info_sql_stmt_exec_procedure = 8,
    isc_info_sql_stmt_start_trans = 9,
    isc_info_sql_stmt_commit = 10,
    isc_info_sql_stmt_rollback = 11,
    isc_info_sql_stmt_select_for_upd = 12,
    isc_info_sql_stmt_set_generator = 13,
    isc_info_sql_stmt_savepoint = 14;

const
    isc_blob_text = 1;

const
    DESCRIBE =
        [isc_info_sql_stmt_type,
        isc_info_sql_select,
            isc_info_sql_describe_vars,
            isc_info_sql_sqlda_seq,
            isc_info_sql_type,
            isc_info_sql_sub_type,
            isc_info_sql_scale,
            isc_info_sql_length,
            isc_info_sql_field,
            isc_info_sql_relation,
            //isc_info_sql_owner,
            isc_info_sql_alias,
            isc_info_sql_describe_end,
         isc_info_sql_bind,
            isc_info_sql_describe_vars,
            isc_info_sql_sqlda_seq,
            isc_info_sql_type,
            isc_info_sql_sub_type,
            isc_info_sql_scale,
            isc_info_sql_length,
            isc_info_sql_describe_end];

const
    ISOLATION_READ_UNCOMMITTED  = [isc_tpb_version3, isc_tpb_write, isc_tpb_wait, isc_tpb_read_committed, isc_tpb_rec_version],
    ISOLATION_READ_COMMITED     = [isc_tpb_version3, isc_tpb_write, isc_tpb_wait, isc_tpb_read_committed, isc_tpb_no_rec_version],
    ISOLATION_REPEATABLE_READ   = [isc_tpb_version3, isc_tpb_write, isc_tpb_wait, isc_tpb_concurrency],
    ISOLATION_SERIALIZABLE      = [isc_tpb_version3, isc_tpb_write, isc_tpb_wait, isc_tpb_consistency],
    ISOLATION_READ_COMMITED_READ_ONLY   = [isc_tpb_version3, isc_tpb_read, isc_tpb_wait, isc_tpb_read_committed, isc_tpb_no_rec_version];

const
    DEFAULT_HOST = '127.0.0.1',
    DEFAULT_PORT = 3050,
    DEFAULT_USER = 'SYSDBA',
    DEFAULT_PASSWORD = 'masterkey',
    DEFAULT_PAGE_SIZE = 4096;

exports.ISOLATION_READ_UNCOMMITTED = ISOLATION_READ_UNCOMMITTED;
exports.ISOLATION_READ_COMMITED = ISOLATION_READ_COMMITED;
exports.ISOLATION_REPEATABLE_READ = ISOLATION_REPEATABLE_READ;
exports.ISOLATION_SERIALIZABLE = ISOLATION_SERIALIZABLE;
exports.ISOLATION_READ_COMMITED_READ_ONLY = ISOLATION_READ_COMMITED_READ_ONLY;

const
    DEFAULT_ENCODING = 'utf8';
    DEFAULT_FETCHSIZE = 200;

const
    MAX_INT = Math.pow(2, 31) - 1;
    MIN_INT = - Math.pow(2, 31);

/***************************************
 *
 *   SQLVar
 *
 ***************************************/


const
    ScaleDivisor = [1,10,100,1000,10000,100000,1000000,10000000,100000000,1000000000,10000000000,
        100000000000,1000000000000,10000000000000,100000000000000,1000000000000000];
const
    DateOffset = 40587,
    TimeCoeff = 86400000;
    MsPerMinute = 60000;

//------------------------------------------------------

function SQLVarText() {}

SQLVarText.prototype.decode = function(data) {
    var ret;
    if (this.subType > 1) {
        ret = data.readText(this.length, DEFAULT_ENCODING);
    } else {
        ret = data.readBuffer(this.length);
    }

    if (!data.readInt()) {
        return ret;
    }
    return null;
};

SQLVarText.prototype.calcBlr = function(blr) {
    blr.addByte(blr_text);
    blr.addWord(this.length);
};

//------------------------------------------------------

function SQLVarNull() {}
SQLVarNull.prototype = new SQLVarText();
SQLVarNull.prototype.constructor = SQLVarNull;

//------------------------------------------------------

function SQLVarString() {}

SQLVarString.prototype.decode = function(data) {
    var ret;
    if (this.subType > 1) {
        ret = data.readString(DEFAULT_ENCODING)
    } else {
        ret = data.readBuffer()
    }
    if (!data.readInt()) {
        return ret;
    }
    return null;
};

SQLVarString.prototype.calcBlr = function(blr) {
    blr.addByte(blr_varying);
    blr.addWord(this.length);
};

//------------------------------------------------------

function SQLVarQuad() {}

SQLVarQuad.prototype.decode = function(data) {
    var ret = data.readQuad();
    if (!data.readInt()) {
        return ret;
    }
    return null;
};

SQLVarQuad.prototype.calcBlr = function(blr) {
    blr.addByte(blr_quad);
    blr.addShort(this.scale);
};

//------------------------------------------------------

function SQLVarBlob() {}
SQLVarBlob.prototype = new SQLVarQuad();
SQLVarBlob.prototype.constructor = SQLVarBlob;

SQLVarBlob.prototype.calcBlr = function(blr) {
    blr.addByte(blr_quad);
    blr.addShort(0);
};

//------------------------------------------------------

function SQLVarArray() {}
SQLVarArray.prototype = new SQLVarQuad();
SQLVarArray.prototype.constructor = SQLVarArray;

SQLVarArray.prototype.calcBlr = function(blr) {
    blr.addByte(blr_quad);
    blr.addShort(0);
};

//------------------------------------------------------

function SQLVarInt() {}

SQLVarInt.prototype.decode = function(data) {
    var ret = data.readInt();
    if (!data.readInt()) {
        if (this.scale) {
            ret = ret / ScaleDivisor[Math.abs(this.scale)];
        }
        return ret;
    }
    return null;
};

SQLVarInt.prototype.calcBlr = function(blr) {
    blr.addByte(blr_long);
    blr.addShort(this.scale);
};

//------------------------------------------------------

function SQLVarShort() {}
SQLVarShort.prototype = new SQLVarInt();
SQLVarShort.prototype.constructor = SQLVarShort;

SQLVarShort.prototype.calcBlr = function(blr) {
    blr.addByte(blr_short);
    blr.addShort(this.scale);
};

//------------------------------------------------------

function SQLVarInt64() {}

SQLVarInt64.prototype.decode = function(data) {
    var ret = data.readInt64();
    if (!data.readInt()) {
        if (this.scale) {
            ret = ret / ScaleDivisor[Math.abs(this.scale)];
        }
        return ret;
    }
    return null;
};

SQLVarInt64.prototype.calcBlr = function(blr) {
    blr.addByte(blr_int64);
    blr.addShort(this.scale);
};

//------------------------------------------------------

function SQLVarFloat() {}

SQLVarFloat.prototype.decode = function(data) {
    var ret = data.readFloat();
    if (!data.readInt()) {
        return ret;
    }
    return null;
};

SQLVarFloat.prototype.calcBlr = function(blr) {
    blr.addByte(blr_float);
};

//------------------------------------------------------

function SQLVarDouble() {}

SQLVarDouble.prototype.decode = function(data) {
    var ret = data.readDouble();
    if (!data.readInt()) {
        return ret;
    }
    return null;
};

SQLVarDouble.prototype.calcBlr = function(blr) {
    blr.addByte(blr_double);
};

//------------------------------------------------------

function SQLVarDate() {}

SQLVarDate.prototype.decode = function(data) {
    var ret = data.readInt();
    if (!data.readInt()) {
        var d = new Date(0);
        d.setMilliseconds((ret - DateOffset) * TimeCoeff + d.getTimezoneOffset() * MsPerMinute);
        return d;
    }
    return null;
};

SQLVarDate.prototype.calcBlr = function(blr) {
    blr.addByte(blr_sql_date);
};

//------------------------------------------------------

function SQLVarTime() {}

SQLVarTime.prototype.decode = function(data) {
    var ret = data.readUInt();
    if (!data.readInt()) {
        var d = new Date(0);
        d.setMilliseconds(Math.floor(ret / 10) + d.getTimezoneOffset() * MsPerMinute);
        return d;
    }
    return null;
};

SQLVarTime.prototype.calcBlr = function(blr) {
    blr.addByte(blr_sql_time);
};

//------------------------------------------------------

function SQLVarTimeStamp() {}

SQLVarTimeStamp.prototype.decode = function(data) {
    var date = data.readInt();
    var time = data.readUInt();
    if (!data.readInt()) {
        var d = new Date(0);
        d.setMilliseconds((date - DateOffset) * TimeCoeff + Math.floor(time / 10) + d.getTimezoneOffset() * MsPerMinute);
        return d;
    }
    return null;
};

SQLVarTimeStamp.prototype.calcBlr = function(blr) {
    blr.addByte(blr_timestamp);
};

//------------------------------------------------------

// todo: test it
function SQLVarBoolean() {}

SQLVarBoolean.prototype.decode = function(data) {
    var ret = data.readInt();
    if (!data.readInt()) {
        return Boolean(ret);
    }
    return null;
};

SQLVarBoolean.prototype.calcBlr = function(blr) {
    blr.addByte(blr_bool);
};

//------------------------------------------------------

function SQLParamInt(value){
    this.value = value;
}

SQLParamInt.prototype.calcBlr = function(blr) {
    blr.addByte(blr_long);
    blr.addShort(0);
};

SQLParamInt.prototype.encode = function(data) {
    if (this.value != null) {
        data.addInt(this.value);
        data.addInt(0);
    } else {
        data.addInt(0);
        data.addInt(1);
    }
};

//------------------------------------------------------

function SQLParamInt64(value){
    this.value = value;
}

SQLParamInt64.prototype.calcBlr = function(blr) {
    blr.addByte(blr_int64);
    blr.addShort(0);
};

SQLParamInt64.prototype.encode = function(data) {
    if (this.value != null) {
        data.addInt64(this.value);
        data.addInt(0);
    } else {
        data.addInt64(0);
        data.addInt(1);
    }
};

//------------------------------------------------------

function SQLParamDouble(value) {
    this.value = value;
}

SQLParamDouble.prototype.encode = function(data) {
    if (this.value != null) {
        data.addDouble(this.value);
        data.addInt(0);
    } else {
        data.addDouble(0);
        data.addInt(1);
    }
};

SQLParamDouble.prototype.calcBlr = function(blr) {
    blr.addByte(blr_double);
};

//------------------------------------------------------

function SQLParamString(value) {
    this.value = value;
}

SQLParamString.prototype.encode = function(data) {
    if (this.value != null) {
        data.addText(this.value, DEFAULT_ENCODING);
        data.addInt(0);
    } else {
        data.addInt(1);
    }
};

SQLParamString.prototype.calcBlr = function(blr) {
    blr.addByte(blr_text);
    var len = this.value ? Buffer.byteLength(this.value, DEFAULT_ENCODING) : 0;
    blr.addWord(len);
};

//------------------------------------------------------

function SQLParamQuad(value) {
    this.value = value;
}

SQLParamQuad.prototype.encode = function(data) {
    if (this.value != null) {
        data.addInt(this.value.high);
        data.addInt(this.value.low);
        data.addInt(0);
    } else {
        data.addInt(0);
        data.addInt(0);
        data.addInt(1);
    }
};

SQLParamQuad.prototype.calcBlr = function(blr) {
    blr.addByte(blr_quad);
    blr.addShort(0);
};

//------------------------------------------------------

function SQLParamDate(value) {
    this.value = value;
}

SQLParamDate.prototype.encode = function(data) {
    if (this.value != null) {
        var value = this.value.getTime() - this.value.getTimezoneOffset() * MsPerMinute;
        var time = value % TimeCoeff;
        var date = (value - time) / TimeCoeff + DateOffset;
        time *= 10;
        data.addInt(date);
        data.addUInt(time);
        data.addInt(0);
    } else {
        data.addInt(0);
        data.addUInt(0);
        data.addInt(1);
    }
};

SQLParamDate.prototype.calcBlr = function(blr) {
    blr.addByte(blr_timestamp);
};

//------------------------------------------------------

function SQLParamBool(value) {
    this.value = value;
}

SQLParamBool.prototype.encode = function(data) {
    if (this.value != null) {
        data.addInt(this.value ? 1 : 0);
        data.addInt(0);
    } else {
        data.addInt(0);
        data.addInt(1);
    }
};

SQLParamBool.prototype.calcBlr = function(blr) {
    blr.addByte(blr_short);
    blr.addShort(0);
};


/***************************************
 *
 *   Error handling
 *
 ***************************************/

function isError(obj) {
    return (obj instanceof Object && obj.status)
}

function doCallback(obj, callback) {
    if (callback) {
        if (isError(obj)) {
            callback(obj)
        } else {
            callback(undefined, obj)
        }
    }
}

function doError(obj, callback) {
    if (callback) {
       callback(obj)
    }
}

/***************************************
 *
 *   Statement
 *
 ***************************************/

function Statement(connection) {
    this.connection = connection;
}

Statement.prototype.close = function(callback) {
    this.connection.closeStatement(this, callback);
};

Statement.prototype.drop = function(callback) {
    this.connection.dropStatement(this, callback);
};

Statement.prototype.execute = function(transaction, params, callback){
    if (params instanceof Function) {
        callback = params;
        params = undefined;
    }
    this.connection.executeStatement(transaction, this, params, callback);
};

Statement.prototype.fetch = function(transaction, count, callback) {
    this.connection.fetch(this, transaction, count, callback);
};

Statement.prototype.fetchAll = function(transaction, callback) {
    this.connection.fetchAll(this, transaction, callback);
};


/***************************************
 *
 *   Transaction
 *
 ***************************************/

function Transaction(connection) {
    this.connection = connection;
}

Transaction.prototype.newStatement = function(query, callback) {
    var cnx = this.connection;
    var self = this;
    cnx.allocateStatement(
        function(err, statement) {
            if (err) {doError(err, callback); return}
            cnx.prepareStatement(self, statement, query, false, callback);
        }
    )
};

Transaction.prototype.execute = function(query, params, callback) {
    if (params instanceof Function) {
        callback = params;
        params = undefined;
    }

    var self = this;
    this.newStatement(query,
        function(err, statement) {
            if (err) {doError(err, callback); return}
            function dropError(err) {
                statement.drop();
                doCallback(err, callback);
            }
            statement.execute(self, params,
                function(err) {
                    if (err) {dropError(err); return}
                    switch (statement.type) {
                        case isc_info_sql_stmt_select:
                            statement.fetchAll(self,
                                function(err, ret) {
                                    if (err) {dropError(err); return}
                                    statement.drop();
                                    if (callback) {
                                        callback(undefined, ret, statement.output, true);
                                    }
                                }
                            );
                            break;
                        case isc_info_sql_stmt_exec_procedure:
                            if (statement.output.length) {
                                statement.fetch(self, 1,
                                    function(err, ret) {
                                        if (err) {dropError(err); return}
                                        statement.drop();
                                        if (callback) {
                                            callback(undefined, ret.data[0], statement.output, false);
                                        }
                                    }
                                );
                                break;
                            }
                        // Fall through is normal
                        default:
                            statement.drop();
                            if (callback) {
                                callback()
                            }
                    }
                }
            )
        }
    )
};

Transaction.prototype.query = function(query, params, callback) {
    if (params instanceof Function) {
        callback = params;
        params = undefined;
    }
    this.execute(query, params, mapFieldNames(callback));
};

Transaction.prototype.commit = function(callback) {
    this.connection.commit(this, callback)
};

Transaction.prototype.rollback = function(callback) {
    this.connection.rollback(this, callback)
};

Transaction.prototype.commitRetaining = function(callback) {
    this.connection.commitRetaining(this, callback)
};

Transaction.prototype.rollbackRetaining = function(callback) {
    this.connection.rollbackRetaining(this, callback)
};

/***************************************
 *
 *   Database
 *
 ***************************************/

function Database(connection) {
    this.connection = connection;
}

Database.prototype.detach = function(callback) {
    var self = this;
    this.connection.detach(
        function(err, obj) {
            self.connection.disconnect();
            if (callback) {
                callback(err, obj);
            }
        }
    );
};

Database.prototype.startTransaction = function(isolation, callback) {
    this.connection.startTransaction(isolation, callback);
};

Database.prototype.newStatement = function (query, callback) {
    this.startTransaction(
        function(err, transaction) {
            if (err) {callback(err); return}
            transaction.newStatement(query,
                function(err, statement) {
                    if (err) {callback(err); return}
                    transaction.commit(
                        function(err) {
                            callback(err, statement);
                        }
                    );
                }
            );
        }
    )
};

Database.prototype.execute = function(query, params, callback) {
    if (params instanceof Function) {
        callback = params;
        params = undefined;
    }

    this.connection.startTransaction(
        function(err, transaction) {
            if (err) {doError(err, callback); return}
            transaction.execute(query, params,
                function(err, result, meta, isSelect) {
                    if (err) {
                        transaction.rollback(
                            function() {
                                doError(err, callback);
                            }
                        )
                    } else {
                        transaction.commit(
                            function(err) {
                                if (callback) {
                                    callback(err, result, meta, isSelect);
                                }
                            }
                        );
                    }
                }
            )
        }
    )
};

function mapFieldNames(callback) {
    if (callback) {
        return function(err, result, meta, isSelect) {
            if (err) {
                doError(err, callback);
            } else {
                if (result) {
                    var lower = new Array(meta.length);
                    for (var k = 0; k  < meta.length; k++) {
                        lower[k] = meta[k].alias.toLowerCase();
                    }
                    function convert(value) {
                        var obj = {};
                        for (var j = 0; j  < lower.length; j++) {
                            obj[lower[j]] = value[j];
                        }
                        return obj;
                    }
                    if (isSelect) {
                        var item;
                        for (var i = 0; i < result.length; i++) {
                            result[i] = convert(result[i]);
                        }
                        callback(undefined, result, meta, isSelect);
                    } else {
                        callback(undefined, convert(result), meta, isSelect);
                    }
                } else {
                    callback();
                }
            }
        }
    } else {
        return undefined;
    }
}

Database.prototype.query = function(query, params, callback) {
    if (params instanceof Function) {
        callback = params;
        params = undefined;
    }
    this.execute(query, params, mapFieldNames(callback));
};

exports.attach = function(options, callback){
    var host = options.host || DEFAULT_HOST;
    var port = options.port || DEFAULT_PORT;
    var cnx = this.connection = new Connection(host, port,
        function(err) {
            if (!err) {
                cnx.connect(options.database,
                    function(err){
                        if (!err) {
                            cnx.attach(options, callback);
                        } else {
                            doError(err, callback)
                        }
                    }
                );
            } else {
                doError(err, callback)
            }
        }
    )
};

exports.create = function(options, callback) {
    var host = options.host || DEFAULT_HOST;
    var port = options.port || DEFAULT_PORT;
    var cnx = this.connection = new Connection(host, port);
    cnx.connect(options.database,
        function(err){
            if (!err) {
                cnx.createDatabase(options, callback);
            } else {
                doError(err, callback)
            }
        }
    );
};

exports.attachOrCreate = function(options, callback) {
    var host = options.host || DEFAULT_HOST;
    var port = options.port || DEFAULT_PORT;
    var cnx = this.connection = new Connection(host, port,
        function(err) {
            if (err) {
                callback({error: err, message: "Connect error"});
                return;
            }
            cnx.connect(options.database,
                function(err){
                    if (!err) {
                        cnx.attach(options,
                            function(err, ret) {
                                if (!err) {
                                    doCallback(ret, callback);
                                } else {
                                    cnx.createDatabase(options, callback);
                                }
                            }
                        );
                    } else {
                        doError(err, callback)
                    }
                }
            );
        }
    );


};

/***************************************
 *
 *   Connection
 *
 ***************************************/

var Connection = exports.Connection = function (host, port, callback){
    this._msg = new XdrWriter(32);
	this._blr = new BlrWriter(32);
	this._queue = [];
	//this._socket = net.createConnection(port, host);
	// use WebTCP socket instead of net library
	this._socket = tcp.createSocket(host, port, {
	                   timeout: 0,
	                             noDelay: true
	                                     });
    var self = this;
    this._socket.on('error', callback);
    this._socket.on('connect', callback);
    this._socket.on('data', function(data) {
        var obj, cb, pos, xdr, buf;
        if (!self._xdr) {
            xdr = new XdrReader(data)
        } else {
            xdr = self._xdr;
            delete(self._xdr);
            buf = new Buffer(data.length + xdr.buffer.length);
            xdr.buffer.copy(buf);
            data.copy(buf, xdr.buffer.length);
            xdr.buffer = buf;
        }

        while (xdr.pos < xdr.buffer.length) {
            pos = xdr.pos;
            try {
                cb = self._queue[0];
                obj = decodeResponse(xdr, cb);
            } catch(err) {
                buf = new Buffer(xdr.buffer.length - pos);
                xdr.buffer.copy(buf, 0, pos);
                xdr.buffer = buf;
                xdr.pos = 0;
                self._xdr = xdr;
                return;
            }
            self._queue.shift();
            if (obj && obj.status) {
                messages.lookupMessages(obj.status,
                    function(message){
                        obj.message = message;
                        doCallback(obj, cb);
                    }
                )
            } else {
                doCallback(obj, cb);
            }
        }
    });
};

exports.Connection.prototype.disconnect = function() {
  this._socket.end();
};

function decodeResponse(data, callback){
    do {var r = data.readInt()} while (r == op_dummy);
    var item, op;
    switch (r) {
        case op_response:
            var response;
            if (callback) {
                response = callback.response || {}
            } else {
                response = {};
            }
            response.handle = data.readInt();
            var oid =  data.readQuad();
            if (oid.low || oid.high) {
                response.oid = oid
            }
            var buf = data.readArray();
            if (buf) {
                response.buffer = buf
            }
            var num;
            while (true) {
                op = data.readInt();
                switch (op){
                    case isc_arg_end:
                        return response;
                    case isc_arg_gds:
                        num = data.readInt();
                        if (num) {
                            item = {gdscode: num};
                            if (response.status) {
                                response.status.push(item)
                            } else {
                                response.status = [item]
                            }
                        }
                        break;
                    case isc_arg_string:
                    case isc_arg_interpreted:
                    case isc_arg_sql_state:
                        if (item.params) {
                            var str = data.readString(DEFAULT_ENCODING);
                            item.params.push(str);
                        } else {
                            item.params = [data.readString(DEFAULT_ENCODING)]
                        }
                        break;
                    case isc_arg_number:
                        num = data.readInt();
                        if (item.params) {
                            item.params.push(num)
                        } else {
                            item.params = [num]
                        }
                        if (item.gdscode == isc_sqlerr) {
                            response.sqlcode = num
                        }
                        break;
                    default:
                        throw new Error('unexpected: ' + op);
                }
            }
            break;
        case op_fetch_response:
            var status = data.readInt();
            var count = data.readInt();
            var statement = callback.statement;
            var output = statement.output;
            var rows = [];
            while (count && (status != 100)) {
                var row = new Array(output.length);
                for(var i = 0; i < output.length; i++) {
                    item = output[i];
                    row[i] = item.decode(data);
                }
                rows.push(row);
                op = data.readInt(); // ??
                status = data.readInt();
                count = data.readInt();
            }
            return {data: rows, fetched: Boolean(status == 100)};
        case op_accept:
            if (
                data.readInt() != PROTOCOL_VERSION10 ||
                    data.readInt() != ARCHITECTURE_GENERIC ||
                    data.readInt() != ptype_batch_send)
            {
                throw new Error('Invalid connect result')
            }
            return {};
        default:
            throw new Error('unexpected:' + r)
    }
}

Connection.prototype._queueEvent = function(callback){
    this._queue.push(callback);
    this._socket.write(this._msg.getData());
};

Connection.prototype.connect = function (database, callback) {
    var msg = this._msg;
    var blr = this._blr;
    msg.pos = 0;
    blr.pos = 0;

    msg.addInt(op_connect);
    msg.addInt(op_attach);
    msg.addInt(CONNECT_VERSION2);
    msg.addInt(ARCHITECTURE_GENERIC);
    msg.addString(database || '', DEFAULT_ENCODING);
    msg.addInt(1);  // Protocol version understood count.

    blr.addString(1, process.env['USER'] || process.env['USERNAME'] || "Unknown", DEFAULT_ENCODING);
    var hostname = os.hostname();
    blr.addString(4, hostname, DEFAULT_ENCODING);
    blr.addBytes([6, 0]);
    msg.addBlr(this._blr);

    msg.addInt(PROTOCOL_VERSION10);
    msg.addInt(ARCHITECTURE_GENERIC);
    msg.addInt(2);  // Min type
    msg.addInt(3);  // Max type
    msg.addInt(2);  // Preference weight

    this._queueEvent(callback);
};


Connection.prototype.attach = function (options, callback) {
    var database = options.database;
    var user = options.user || DEFAULT_USER;
    var password = options.password || DEFAULT_PASSWORD;
    var role = options.role;

    var msg = this._msg;
    var blr = this._blr;
    msg.pos = 0;
    blr.pos = 0;

    blr.addByte(1);
    blr.addString(isc_dpb_lc_ctype, 'UTF8', DEFAULT_ENCODING);
    blr.addString(isc_dpb_user_name, user, DEFAULT_ENCODING);
    blr.addString(isc_dpb_password, password, DEFAULT_ENCODING);
    if (role) {
        blr.addString(isc_dpb_sql_role_name, role, DEFAULT_ENCODING);
    }

    msg.addInt(op_attach);
    msg.addInt(0);  // Database Object ID
    msg.addString(database, DEFAULT_ENCODING);
    msg.addBlr(this._blr);

    var self = this;
    function cb(err, ret) {
        if (err) {doError(err, callback); return}
        self.dbhandle = ret.handle;
        if (callback) {
            callback(undefined, ret);
        }
    }
    cb.response = new Database(this);
    this._queueEvent(cb);
};

Connection.prototype.detach = function (callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_detach);
    msg.addInt(0); // Database Object ID
    var self = this;
    this._queueEvent(
        function (err, ret) {
            delete(self.dbhandle);
            if (callback) {
                callback(err, ret);
            }
        }
    );
};

Connection.prototype.createDatabase = function (options, callback) {
    var database = options.database;
    var user = options.user || DEFAULT_USER;
    var password = options.password || DEFAULT_PASSWORD;
    var pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
    var role = options.role;

    var blr = this._blr;
    blr.pos = 0;
    blr.addByte(1);
    blr.addString(isc_dpb_set_db_charset, 'UTF8', DEFAULT_ENCODING);
    blr.addString(isc_dpb_lc_ctype, 'UTF8', DEFAULT_ENCODING);
    blr.addString(isc_dpb_user_name, user, DEFAULT_ENCODING);
    blr.addString(isc_dpb_password, password, DEFAULT_ENCODING);
    if (role) {
        blr.addString(isc_dpb_sql_role_name, role, DEFAULT_ENCODING);
    }
    blr.addNumeric(isc_dpb_sql_dialect, 3);
    blr.addNumeric(isc_dpb_force_write, 1);
    blr.addNumeric(isc_dpb_overwrite, 1);
    blr.addNumeric(isc_dpb_page_size, pageSize);

    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_create);	// op_create
    msg.addInt(0);	// Database Object ID
    msg.addString(database, DEFAULT_ENCODING);
    msg.addBlr(blr);

    var self = this;
    function cb(err, ret) {
        if (ret) {
            self.dbhandle = ret.handle;
        }

        if (callback) {
            callback(err, ret);
        }
    }
    cb.response = new Database(this);
    this._queueEvent(cb);
};

Connection.prototype.startTransaction = function (isolation, callback) {
    var blr = this._blr;
    var msg = this._msg;
    blr.pos = 0;
    msg.pos = 0;
    if (isolation instanceof Function) {
        callback = isolation;
        isolation = null;
    }

    blr.addBytes(isolation || ISOLATION_REPEATABLE_READ);
    msg.addInt(op_transaction);
    msg.addInt(this.dbhandle);
    msg.addBlr(blr);
    callback.response = new Transaction(this);
    this._queueEvent(callback);
};

Connection.prototype.commit = function (transaction, callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_commit);
    msg.addInt(transaction.handle);
    this._queueEvent(callback);
};

Connection.prototype.rollback = function (transaction, callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_rollback);
    msg.addInt(transaction.handle);
    this._queueEvent(callback);
};

Connection.prototype.commitRetaining = function (transaction, callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_commit_retaining);
    msg.addInt(transaction.handle);
    this._queueEvent(callback);
};

Connection.prototype.rollbackRetaining = function (transaction, callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_rollback_retaining);
    msg.addInt(transaction.handle);
    this._queueEvent(callback);
};

Connection.prototype.allocateStatement = function (callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_allocate_statement);
    msg.addInt(this.dbhandle);
    callback.response = new Statement(this);
    this._queueEvent(callback);
};

Connection.prototype.dropStatement = function (statement, callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_free_statement);
    msg.addInt(statement.handle);
    msg.addInt(DSQL_drop);
    this._queueEvent(callback);
};

Connection.prototype.closeStatement = function (statement, callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_free_statement);
    msg.addInt(statement.handle);
    msg.addInt(DSQL_close);
    this._queueEvent(callback);
};

function describe(ret, statement){
    var br = new BlrReader(ret.buffer);
    var parameters = null;
    var type, param;
    while (br.pos < br.buffer.length) {
        switch (br.readByteCode()) {
            case isc_info_sql_stmt_type:
                statement.type = br.readInt();
                break;
            case isc_info_sql_get_plan:
                statement.plan = br.readString(DEFAULT_ENCODING);
                break;
            case isc_info_sql_select:
                statement.output = parameters = [];
                break;
            case isc_info_sql_bind:
                statement.input = parameters = [];
                break;
            case isc_info_sql_num_variables:
                br.readInt(); // eat int
                break;
            case isc_info_sql_describe_vars:
                if (!parameters) {return}
                br.readInt(); // eat int ?
                var finishDescribe = false;
                param = null;
                while (!finishDescribe){
                    switch (br.readByteCode()) {
                        case isc_info_sql_describe_end:
                            break;
                        case isc_info_sql_sqlda_seq:
                            var num = br.readInt();
                            break;
                        case isc_info_sql_type:
                            type = br.readInt();
                            switch (type&~1) {
                                case SQL_VARYING:   param = new SQLVarString(); break;
                                case SQL_NULL:      param = new SQLVarNull(); break;
                                case SQL_TEXT:      param = new SQLVarText(); break;
                                case SQL_DOUBLE:    param = new SQLVarDouble(); break;
                                case SQL_FLOAT:
                                case SQL_D_FLOAT:   param = new SQLVarFloat(); break;
                                case SQL_TYPE_DATE: param = new SQLVarDate(); break;
                                case SQL_TYPE_TIME: param = new SQLVarTime(); break;
                                case SQL_TIMESTAMP: param = new SQLVarTimeStamp(); break;
                                case SQL_BLOB:      param = new SQLVarBlob(); break;
                                case SQL_ARRAY:     param = new SQLVarArray(); break;
                                case SQL_QUAD:      param = new SQLVarQuad(); break;
                                case SQL_LONG:      param = new SQLVarInt(); break;
                                case SQL_SHORT:     param = new SQLVarShort(); break;
                                case SQL_INT64:     param = new SQLVarInt64(); break;
                                case SQL_BOOLEAN:   param = new SQLVarBoolean(); break;
                                default:
                                    throw new Error('unexpected')
                            }
                            parameters[num-1] = param;
                            param.type = type;
                            param.nullable = Boolean(param.type & 1);
                            param.type &= ~1;
                            break;
                        case isc_info_sql_sub_type:
                            param.subType = br.readInt();
                            break;
                        case isc_info_sql_scale:
                            param.scale = br.readInt();
                            break;
                        case isc_info_sql_length:
                            param.length = br.readInt();
                            break;
                        case isc_info_sql_null_ind:
                            param.nullable = Boolean(br.readInt());
                            break;
                        case isc_info_sql_field:
                            param.field = br.readString(DEFAULT_ENCODING);
                            break;
                        case isc_info_sql_relation:
                            param.relation = br.readString(DEFAULT_ENCODING);
                            break;
                        case isc_info_sql_owner:
                            param.owner = br.readString(DEFAULT_ENCODING);
                            break;
                        case isc_info_sql_alias:
                            param.alias = br.readString(DEFAULT_ENCODING);
                            break;
                        case isc_info_sql_relation_alias:
                            param.relationAlias = br.readString(DEFAULT_ENCODING);
                            break;
                        case isc_info_truncated:
                            throw new Error('truncated');
                        default:
                            finishDescribe = true;
                            br.pos--;
                    }
                }
        }
    }
}

Connection.prototype.prepareStatement = function (transaction, statement, query, plan, callback) {
    var msg = this._msg;
    var blr = this._blr;
    msg.pos = 0;
    blr.pos = 0;
    if (plan instanceof Function) {
        callback = plan;
        plan = false;
    }

    blr.addBytes(DESCRIBE);
    if (plan) {blr.addByte(isc_info_sql_get_plan)}
    msg.addInt(op_prepare_statement);
    msg.addInt(transaction.handle);
    msg.addInt(statement.handle);
    msg.addInt(3); // dialect = 3
    msg.addString(query, DEFAULT_ENCODING);
    msg.addBlr(blr);
    msg.addInt(65535); // buffer_length

    this._queueEvent(
        function(err, ret) {
            if (!err){
                describe(ret, statement);
                statement.query = query;
                ret = statement;
            }
            if (callback) {
                callback(err, ret);
            }
        }
    );
};

function CalcBlr(blr, xsqlda) {
    blr.addBytes([blr_version5, blr_begin, blr_message, 0]); // + message number
    blr.addWord(xsqlda.length * 2);
    for (var i = 0; i < xsqlda.length; i++) {
        xsqlda[i].calcBlr(blr);
        blr.addByte(blr_short);
        blr.addByte(0);
    }
    blr.addByte(blr_end);
    blr.addByte(blr_eoc);
}

Connection.prototype.executeStatement = function(transaction, statement, params, callback){

    if (params instanceof Function) {
        callback = params;
        params = undefined;
    }

    var self = this;
    function PrepareParams(params, input, callback) {
        var value, meta;
        var ret = new Array(params.length);
        var wait = params.length;

        function done(){
            wait--;
            if (wait === 0) {
                callback(ret);
            }
        }

        function putBlobData(index, value, callback){
            self.createBlob2(transaction,
                function(err, blob){
                    var b;
                    if (Buffer.isBuffer(value)) {
                        b = value;
                    } else if (typeof value === 'string') {
                        b = new Buffer(value, DEFAULT_ENCODING)
                    } else {
                        b = new Buffer(JSON.stringify(value), DEFAULT_ENCODING)
                    }

                    var start = 0;
                    var end = 1024;
                    batch(callback);

                    function batch(callback){
                        if (b.length <= end) {
                            end = undefined; // get remaining bytes
                        }
                        self.batchSegments(blob, b.slice(start, end),
                            function (){
                                if (end === undefined) {
                                    ret[index] = new SQLParamQuad(blob.oid);
                                    self.closeBlob(blob, callback);
                                } else {
                                    start += 1024;
                                    end += 1024;
                                    batch(callback);
                                }
                            }
                        )
                    }
                }
            );
        }

        for (var i = 0; i < params.length; i++) {
            value = params[i];
            meta = input[i];

            if (value == null) {
                switch (meta.type) {
                    case SQL_VARYING:
                    case SQL_NULL:
                    case SQL_TEXT:
                        ret[i] = new SQLParamString(null);
                        break;
                    case SQL_DOUBLE:
                    case SQL_FLOAT:
                    case SQL_D_FLOAT:
                        ret[i] = new SQLParamDouble(null);
                        break;
                    case SQL_TYPE_DATE:
                    case SQL_TYPE_TIME:
                    case SQL_TIMESTAMP:
                        ret[i] = new SQLParamDate(null);
                        break;
                    case SQL_BLOB:
                    case SQL_ARRAY:
                    case SQL_QUAD:
                        ret[i] = new SQLParamQuad(null);
                        break;
                    case SQL_LONG:
                    case SQL_SHORT:
                    case SQL_INT64:
                    case SQL_BOOLEAN:
                        ret[i] = new SQLParamInt(null);
                        break;
                    default:
                        ret[i] = null;
                }
                done();
            } else {
                switch (meta.type) {
                    case SQL_BLOB:
                        putBlobData(i, value, done);
                        break;
                    case SQL_TIMESTAMP:
                    case SQL_TYPE_DATE:
                    case SQL_TYPE_TIME:
                        if (value instanceof Date) {
                            ret[i] = new SQLParamDate(value);
                        } else {
                            ret[i] = new SQLParamDate(new Date(value));
                        }
                        done();
                        break;
                    default:
                        switch (typeof value) {
                            case 'number':
                                if (value % 1 === 0) {
                                    if (value >= MIN_INT && value <= MAX_INT) {
                                        ret[i] = new SQLParamInt(value)
                                    } else {
                                        ret[i] = new SQLParamInt64(value)
                                    }
                                } else {
                                    ret[i] = new SQLParamDouble(value);
                                }
                                break;
                            case 'string':
                                ret[i] = new SQLParamString(value);
                                break;
                            case 'boolean':
                                ret[i] = new SQLParamBool(value);
                                break;
                            default:
                                throw new Error("Unexpected parametter");
                        }
                        done();
                }
            }
        }
    }


    var input = statement.input;
    if (input.length) {
        if (!(params instanceof Array)) {
            if (params !== undefined) {
                params = [params];
            } else {
                params = [];
            }
        }
        if (params === undefined || params.length != input.length) {
            throw new Error("expected parametters: " + input.length);
        }
        PrepareParams(params, input,
            function(prms){

                var msg = self._msg;
                var blr = self._blr;
                msg.pos = 0;
                blr.pos = 0;

                CalcBlr(blr, prms);

                msg.addInt(op_execute);
                msg.addInt(statement.handle);
                msg.addInt(transaction.handle);

                msg.addBlr(blr);
                msg.addInt(0); // message number
                msg.addInt(1); // param count
                for(var i = 0; i < prms.length; i++) {
                    prms[i].encode(msg);
                }
                self._queueEvent(callback);
            }
        );

    } else {
        var msg = this._msg;
        var blr = this._blr;
        msg.pos = 0;
        blr.pos = 0;

        msg.addInt(op_execute);
        msg.addInt(statement.handle);
        msg.addInt(transaction.handle);

        msg.addBlr(blr); // empty
        msg.addInt(0); // message number
        msg.addInt(0); // param count
        this._queueEvent(callback);
    }
};

function fetchBlobs(statement, transaction, rows, callback) {
    if (rows.data && rows.data.length) {
        var indexes = [];
        for (var i = 0; i < statement.output.length; i++) {
            if (statement.output[i].type == SQL_BLOB) {
                indexes.push(i);
            }
        }
        if (indexes.length) {
            function fetch(row, col, callback) {
                var blobid = rows.data[row][col];
                if (blobid) {
                    statement.connection.openBlob(blobid, transaction,
                        function(err, blob) {
                            if (err) {callback(err); return}
                            var buffer;
                            function read() {
                                statement.connection.getSegment(blob,
                                    function(err, ret) {
                                        if (err) {callback(err); return}
                                        var blr = new BlrReader(ret.buffer);
                                        var data = blr.readSegment();
                                        if (buffer) {
                                            var tmp = buffer;
                                            buffer = new Buffer(tmp.length + data.length);
                                            tmp.copy(buffer);
                                            data.copy(buffer, tmp.length);
                                        } else {
                                            buffer = data;
                                        }
                                        if (ret.handle == 2) { // ???
                                            if (statement.output[col].subType == isc_blob_text) {
                                                if (buffer) {
                                                    rows.data[row][col] = buffer.toString(DEFAULT_ENCODING);
                                                } else {
                                                    rows.data[row][col] = null;
                                                }

                                            } else {
                                                rows.data[row][col] = buffer
                                            }
                                            callback();
                                            statement.connection.closeBlob(blob);
                                        } else {
                                            read();
                                        }
                                    }
                                );
                            }
                            read()
                        }
                    )
                } else {
                    callback()
                }
            }

            var count = rows.data.length * indexes.length;
            for (var r = 0; r < rows.data.length; r++) {
                for (var c = 0; c < indexes.length; c++) {
                    fetch(r, indexes[c],
                        function(err) {
                            if (!err) {
                                count--;
                                if (count == 0) {
                                   callback(undefined, rows)
                                }
                            } else {
                                callback(err);
                            }
                        }
                    );
                }
            }
        } else {
            callback(undefined, rows)
        }
    } else {
        callback(undefined, rows)
    }
}

Connection.prototype.fetch = function(statement, transaction, count, callback) {
    var msg = this._msg;
    var blr = this._blr;
    msg.pos = 0;
    blr.pos = 0;
    if (count instanceof Function) {
        callback = count;
        count = DEFAULT_FETCHSIZE;
    }
    msg.addInt(op_fetch);
    msg.addInt(statement.handle);
    CalcBlr(blr, statement.output);
    msg.addBlr(blr);
    msg.addInt(0); // message number
    msg.addInt(count || DEFAULT_FETCHSIZE); // fetch count


    if (transaction) {
        var cb = function(err, ret) {
            if (!err) {
                fetchBlobs(statement, transaction, ret, callback);
            } else {
                callback(err, ret);
            }
        };
        cb.statement = statement;
        this._queueEvent(cb);

    } else {
        callback.statement = statement;
        this._queueEvent(callback);
    }
};

Connection.prototype.fetchAll = function(statement, transaction, callback) {
    var self = this;
    var data;
    var loop = function(err, ret){
        if (err) {callback(err); return};
        if (!data) {
            data = ret.data;
        } else {
            for (var i = 0; i < ret.data.length; i++) {
                data.push(ret.data[i]);
            }
        }
        if (ret.fetched) {
            callback(undefined, data)
        } else {
            self.fetch(statement, transaction, DEFAULT_FETCHSIZE, loop)
        }
    };
    this.fetch(statement, transaction, DEFAULT_FETCHSIZE, loop);
};

Connection.prototype.openBlob = function(blob, transaction, callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_open_blob);
    msg.addInt(transaction.handle);
    msg.addQuad(blob);
    this._queueEvent(callback);
};

Connection.prototype.closeBlob = function(blob, callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_close_blob);
    msg.addInt(blob.handle);
    this._queueEvent(callback);
};

Connection.prototype.getSegment = function(blob, callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_get_segment);
    msg.addInt(blob.handle);
    msg.addInt(1024); // buffer length
    msg.addInt(0); // ???
    this._queueEvent(callback);
};

Connection.prototype.createBlob2 = function (transaction, callback) {
    var msg = this._msg;
    msg.pos = 0;
    msg.addInt(op_create_blob2);
    msg.addInt(0);
    msg.addInt(transaction.handle);
    msg.addInt(0);
    msg.addInt(0);
    this._queueEvent(callback);
};

Connection.prototype.batchSegments = function(blob, buffer, callback){
    var msg = this._msg;
    var blr = this._blr;
    msg.pos = 0;
    blr.pos = 0;
    msg.addInt(op_batch_segments);
    msg.addInt(blob.handle);
    msg.addInt(buffer.length + 2);
    blr.addBuffer(buffer);
    msg.addBlr(blr);
    this._queueEvent(callback);
};
}).call(this,require("/usr/local/lib/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),require("buffer").Buffer)
},{"./messages.js":3,"./serialize.js":4,"/usr/local/lib/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":9,"buffer":6,"net":5,"os":10}],2:[function(require,module,exports){
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Copyright 2009 Google Inc. All Rights Reserved

/**
 * Defines a Long class for representing a 64-bit two's-complement
 * integer value, which faithfully simulates the behavior of a Java "Long". This
 * implementation is derived from LongLib in GWT.
 *
 * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
 * values as *signed* integers.  See the from* functions below for more
 * convenient ways of constructing Longs.
 *
 * The internal representation of a Long is the two given signed, 32-bit values.
 * We use 32-bit pieces because these are the size of integers on which
 * Javascript performs bit-operations.  For operations like addition and
 * multiplication, we split each number into 16-bit pieces, which can easily be
 * multiplied within Javascript's floating-point representation without overflow
 * or change in sign.
 *
 * In the algorithms below, we frequently reduce the negative case to the
 * positive case by negating the input(s) and then post-processing the result.
 * Note that we must ALWAYS check specially whether those values are MIN_VALUE
 * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
 * a positive number, it overflows back into a negative).  Not handling this
 * case would often result in infinite recursion.
 *
 * @class Represents the BSON Long type.
 * @param {Number} low  the low (signed) 32 bits of the Long.
 * @param {Number} high the high (signed) 32 bits of the Long.
 */
function Long(low, high) {
  if(!(this instanceof Long)) return new Long(low, high);
  
  /**
   * @type {number}
   * @api private
   */
  this.low_ = low | 0;  // force into 32 signed bits.

  /**
   * @type {number}
   * @api private
   */
  this.high_ = high | 0;  // force into 32 signed bits.
};

/**
 * Return the int value.
 *
 * @return {Number} the value, assuming it is a 32-bit integer.
 * @api public
 */
Long.prototype.toInt = function() {
  return this.low_;
};

/**
 * Return the Number value.
 *
 * @return {Number} the closest floating-point representation to this value.
 * @api public
 */
Long.prototype.toNumber = function() {
  return this.high_ * Long.TWO_PWR_32_DBL_ +
         this.getLowBitsUnsigned();
};

/**
 * Return the JSON value.
 *
 * @return {String} the JSON representation.
 * @api public
 */
Long.prototype.toJSON = function() {
  return this.toString();
}

/**
 * Return the String value.
 *
 * @param {Number} [opt_radix] the radix in which the text should be written.
 * @return {String} the textual representation of this value.
 * @api public
 */
Long.prototype.toString = function(opt_radix) {
  var radix = opt_radix || 10;
  if (radix < 2 || 36 < radix) {
    throw Error('radix out of range: ' + radix);
  }

  if (this.isZero()) {
    return '0';
  }

  if (this.isNegative()) {
    if (this.equals(Long.MIN_VALUE)) {
      // We need to change the Long value before it can be negated, so we remove
      // the bottom-most digit in this base and then recurse to do the rest.
      var radixLong = Long.fromNumber(radix);
      var div = this.div(radixLong);
      var rem = div.multiply(radixLong).subtract(this);
      return div.toString(radix) + rem.toInt().toString(radix);
    } else {
      return '-' + this.negate().toString(radix);
    }
  }

  // Do several (6) digits each time through the loop, so as to
  // minimize the calls to the very expensive emulated div.
  var radixToPower = Long.fromNumber(Math.pow(radix, 6));

  var rem = this;
  var result = '';
  while (true) {
    var remDiv = rem.div(radixToPower);
    var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
    var digits = intval.toString(radix);

    rem = remDiv;
    if (rem.isZero()) {
      return digits + result;
    } else {
      while (digits.length < 6) {
        digits = '0' + digits;
      }
      result = '' + digits + result;
    }
  }
};

/**
 * Return the high 32-bits value.
 *
 * @return {Number} the high 32-bits as a signed value.
 * @api public
 */
Long.prototype.getHighBits = function() {
  return this.high_;
};

/**
 * Return the low 32-bits value.
 *
 * @return {Number} the low 32-bits as a signed value.
 * @api public
 */
Long.prototype.getLowBits = function() {
  return this.low_;
};

/**
 * Return the low unsigned 32-bits value.
 *
 * @return {Number} the low 32-bits as an unsigned value.
 * @api public
 */
Long.prototype.getLowBitsUnsigned = function() {
  return (this.low_ >= 0) ?
      this.low_ : Long.TWO_PWR_32_DBL_ + this.low_;
};

/**
 * Returns the number of bits needed to represent the absolute value of this Long.
 *
 * @return {Number} Returns the number of bits needed to represent the absolute value of this Long.
 * @api public
 */
Long.prototype.getNumBitsAbs = function() {
  if (this.isNegative()) {
    if (this.equals(Long.MIN_VALUE)) {
      return 64;
    } else {
      return this.negate().getNumBitsAbs();
    }
  } else {
    var val = this.high_ != 0 ? this.high_ : this.low_;
    for (var bit = 31; bit > 0; bit--) {
      if ((val & (1 << bit)) != 0) {
        break;
      }
    }
    return this.high_ != 0 ? bit + 33 : bit + 1;
  }
};

/**
 * Return whether this value is zero.
 *
 * @return {Boolean} whether this value is zero.
 * @api public
 */
Long.prototype.isZero = function() {
  return this.high_ == 0 && this.low_ == 0;
};

/**
 * Return whether this value is negative.
 *
 * @return {Boolean} whether this value is negative.
 * @api public
 */
Long.prototype.isNegative = function() {
  return this.high_ < 0;
};

/**
 * Return whether this value is odd.
 *
 * @return {Boolean} whether this value is odd.
 * @api public
 */
Long.prototype.isOdd = function() {
  return (this.low_ & 1) == 1;
};

/**
 * Return whether this Long equals the other
 *
 * @param {Long} other Long to compare against.
 * @return {Boolean} whether this Long equals the other
 * @api public
 */
Long.prototype.equals = function(other) {
  return (this.high_ == other.high_) && (this.low_ == other.low_);
};

/**
 * Return whether this Long does not equal the other.
 *
 * @param {Long} other Long to compare against.
 * @return {Boolean} whether this Long does not equal the other.
 * @api public
 */
Long.prototype.notEquals = function(other) {
  return (this.high_ != other.high_) || (this.low_ != other.low_);
};

/**
 * Return whether this Long is less than the other.
 *
 * @param {Long} other Long to compare against.
 * @return {Boolean} whether this Long is less than the other.
 * @api public
 */
Long.prototype.lessThan = function(other) {
  return this.compare(other) < 0;
};

/**
 * Return whether this Long is less than or equal to the other.
 *
 * @param {Long} other Long to compare against.
 * @return {Boolean} whether this Long is less than or equal to the other.
 * @api public
 */
Long.prototype.lessThanOrEqual = function(other) {
  return this.compare(other) <= 0;
};

/**
 * Return whether this Long is greater than the other.
 *
 * @param {Long} other Long to compare against.
 * @return {Boolean} whether this Long is greater than the other.
 * @api public
 */
Long.prototype.greaterThan = function(other) {
  return this.compare(other) > 0;
};

/**
 * Return whether this Long is greater than or equal to the other.
 *
 * @param {Long} other Long to compare against.
 * @return {Boolean} whether this Long is greater than or equal to the other.
 * @api public
 */
Long.prototype.greaterThanOrEqual = function(other) {
  return this.compare(other) >= 0;
};

/**
 * Compares this Long with the given one.
 *
 * @param {Long} other Long to compare against.
 * @return {Boolean} 0 if they are the same, 1 if the this is greater, and -1 if the given one is greater.
 * @api public
 */
Long.prototype.compare = function(other) {
  if (this.equals(other)) {
    return 0;
  }

  var thisNeg = this.isNegative();
  var otherNeg = other.isNegative();
  if (thisNeg && !otherNeg) {
    return -1;
  }
  if (!thisNeg && otherNeg) {
    return 1;
  }

  // at this point, the signs are the same, so subtraction will not overflow
  if (this.subtract(other).isNegative()) {
    return -1;
  } else {
    return 1;
  }
};

/**
 * The negation of this value.
 *
 * @return {Long} the negation of this value.
 * @api public
 */
Long.prototype.negate = function() {
  if (this.equals(Long.MIN_VALUE)) {
    return Long.MIN_VALUE;
  } else {
    return this.not().add(Long.ONE);
  }
};

/**
 * Returns the sum of this and the given Long.
 *
 * @param {Long} other Long to add to this one.
 * @return {Long} the sum of this and the given Long.
 * @api public
 */
Long.prototype.add = function(other) {
  // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

  var a48 = this.high_ >>> 16;
  var a32 = this.high_ & 0xFFFF;
  var a16 = this.low_ >>> 16;
  var a00 = this.low_ & 0xFFFF;

  var b48 = other.high_ >>> 16;
  var b32 = other.high_ & 0xFFFF;
  var b16 = other.low_ >>> 16;
  var b00 = other.low_ & 0xFFFF;

  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
  c00 += a00 + b00;
  c16 += c00 >>> 16;
  c00 &= 0xFFFF;
  c16 += a16 + b16;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c32 += a32 + b32;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c48 += a48 + b48;
  c48 &= 0xFFFF;
  return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
};

/**
 * Returns the difference of this and the given Long.
 *
 * @param {Long} other Long to subtract from this.
 * @return {Long} the difference of this and the given Long.
 * @api public
 */
Long.prototype.subtract = function(other) {
  return this.add(other.negate());
};

/**
 * Returns the product of this and the given Long.
 *
 * @param {Long} other Long to multiply with this.
 * @return {Long} the product of this and the other.
 * @api public
 */
Long.prototype.multiply = function(other) {
  if (this.isZero()) {
    return Long.ZERO;
  } else if (other.isZero()) {
    return Long.ZERO;
  }

  if (this.equals(Long.MIN_VALUE)) {
    return other.isOdd() ? Long.MIN_VALUE : Long.ZERO;
  } else if (other.equals(Long.MIN_VALUE)) {
    return this.isOdd() ? Long.MIN_VALUE : Long.ZERO;
  }

  if (this.isNegative()) {
    if (other.isNegative()) {
      return this.negate().multiply(other.negate());
    } else {
      return this.negate().multiply(other).negate();
    }
  } else if (other.isNegative()) {
    return this.multiply(other.negate()).negate();
  }

  // If both Longs are small, use float multiplication
  if (this.lessThan(Long.TWO_PWR_24_) &&
      other.lessThan(Long.TWO_PWR_24_)) {
    return Long.fromNumber(this.toNumber() * other.toNumber());
  }

  // Divide each Long into 4 chunks of 16 bits, and then add up 4x4 products.
  // We can skip products that would overflow.

  var a48 = this.high_ >>> 16;
  var a32 = this.high_ & 0xFFFF;
  var a16 = this.low_ >>> 16;
  var a00 = this.low_ & 0xFFFF;

  var b48 = other.high_ >>> 16;
  var b32 = other.high_ & 0xFFFF;
  var b16 = other.low_ >>> 16;
  var b00 = other.low_ & 0xFFFF;

  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
  c00 += a00 * b00;
  c16 += c00 >>> 16;
  c00 &= 0xFFFF;
  c16 += a16 * b00;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c16 += a00 * b16;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c32 += a32 * b00;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c32 += a16 * b16;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c32 += a00 * b32;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
  c48 &= 0xFFFF;
  return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
};

/**
 * Returns this Long divided by the given one.
 *
 * @param {Long} other Long by which to divide.
 * @return {Long} this Long divided by the given one.
 * @api public
 */
Long.prototype.div = function(other) {
  if (other.isZero()) {
    throw Error('division by zero');
  } else if (this.isZero()) {
    return Long.ZERO;
  }

  if (this.equals(Long.MIN_VALUE)) {
    if (other.equals(Long.ONE) ||
        other.equals(Long.NEG_ONE)) {
      return Long.MIN_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
    } else if (other.equals(Long.MIN_VALUE)) {
      return Long.ONE;
    } else {
      // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
      var halfThis = this.shiftRight(1);
      var approx = halfThis.div(other).shiftLeft(1);
      if (approx.equals(Long.ZERO)) {
        return other.isNegative() ? Long.ONE : Long.NEG_ONE;
      } else {
        var rem = this.subtract(other.multiply(approx));
        var result = approx.add(rem.div(other));
        return result;
      }
    }
  } else if (other.equals(Long.MIN_VALUE)) {
    return Long.ZERO;
  }

  if (this.isNegative()) {
    if (other.isNegative()) {
      return this.negate().div(other.negate());
    } else {
      return this.negate().div(other).negate();
    }
  } else if (other.isNegative()) {
    return this.div(other.negate()).negate();
  }

  // Repeat the following until the remainder is less than other:  find a
  // floating-point that approximates remainder / other *from below*, add this
  // into the result, and subtract it from the remainder.  It is critical that
  // the approximate value is less than or equal to the real value so that the
  // remainder never becomes negative.
  var res = Long.ZERO;
  var rem = this;
  while (rem.greaterThanOrEqual(other)) {
    // Approximate the result of division. This may be a little greater or
    // smaller than the actual value.
    var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));

    // We will tweak the approximate result by changing it in the 48-th digit or
    // the smallest non-fractional digit, whichever is larger.
    var log2 = Math.ceil(Math.log(approx) / Math.LN2);
    var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);

    // Decrease the approximation until it is smaller than the remainder.  Note
    // that if it is too large, the product overflows and is negative.
    var approxRes = Long.fromNumber(approx);
    var approxRem = approxRes.multiply(other);
    while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
      approx -= delta;
      approxRes = Long.fromNumber(approx);
      approxRem = approxRes.multiply(other);
    }

    // We know the answer can't be zero... and actually, zero would cause
    // infinite recursion since we would make no progress.
    if (approxRes.isZero()) {
      approxRes = Long.ONE;
    }

    res = res.add(approxRes);
    rem = rem.subtract(approxRem);
  }
  return res;
};

/**
 * Returns this Long modulo the given one.
 *
 * @param {Long} other Long by which to mod.
 * @return {Long} this Long modulo the given one.
 * @api public
 */
Long.prototype.modulo = function(other) {
  return this.subtract(this.div(other).multiply(other));
};

/**
 * The bitwise-NOT of this value.
 *
 * @return {Long} the bitwise-NOT of this value.
 * @api public
 */
Long.prototype.not = function() {
  return Long.fromBits(~this.low_, ~this.high_);
};

/**
 * Returns the bitwise-AND of this Long and the given one.
 *
 * @param {Long} other the Long with which to AND.
 * @return {Long} the bitwise-AND of this and the other.
 * @api public
 */
Long.prototype.and = function(other) {
  return Long.fromBits(this.low_ & other.low_, this.high_ & other.high_);
};

/**
 * Returns the bitwise-OR of this Long and the given one.
 *
 * @param {Long} other the Long with which to OR.
 * @return {Long} the bitwise-OR of this and the other.
 * @api public
 */
Long.prototype.or = function(other) {
  return Long.fromBits(this.low_ | other.low_, this.high_ | other.high_);
};

/**
 * Returns the bitwise-XOR of this Long and the given one.
 *
 * @param {Long} other the Long with which to XOR.
 * @return {Long} the bitwise-XOR of this and the other.
 * @api public
 */
Long.prototype.xor = function(other) {
  return Long.fromBits(this.low_ ^ other.low_, this.high_ ^ other.high_);
};

/**
 * Returns this Long with bits shifted to the left by the given amount.
 *
 * @param {Number} numBits the number of bits by which to shift.
 * @return {Long} this shifted to the left by the given amount.
 * @api public
 */
Long.prototype.shiftLeft = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var low = this.low_;
    if (numBits < 32) {
      var high = this.high_;
      return Long.fromBits(
                 low << numBits,
                 (high << numBits) | (low >>> (32 - numBits)));
    } else {
      return Long.fromBits(0, low << (numBits - 32));
    }
  }
};

/**
 * Returns this Long with bits shifted to the right by the given amount.
 *
 * @param {Number} numBits the number of bits by which to shift.
 * @return {Long} this shifted to the right by the given amount.
 * @api public
 */
Long.prototype.shiftRight = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var high = this.high_;
    if (numBits < 32) {
      var low = this.low_;
      return Long.fromBits(
                 (low >>> numBits) | (high << (32 - numBits)),
                 high >> numBits);
    } else {
      return Long.fromBits(
                 high >> (numBits - 32),
                 high >= 0 ? 0 : -1);
    }
  }
};

/**
 * Returns this Long with bits shifted to the right by the given amount, with the new top bits matching the current sign bit.
 *
 * @param {Number} numBits the number of bits by which to shift.
 * @return {Long} this shifted to the right by the given amount, with zeros placed into the new leading bits.
 * @api public
 */
Long.prototype.shiftRightUnsigned = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var high = this.high_;
    if (numBits < 32) {
      var low = this.low_;
      return Long.fromBits(
                 (low >>> numBits) | (high << (32 - numBits)),
                 high >>> numBits);
    } else if (numBits == 32) {
      return Long.fromBits(high, 0);
    } else {
      return Long.fromBits(high >>> (numBits - 32), 0);
    }
  }
};

/**
 * Returns a Long representing the given (32-bit) integer value.
 *
 * @param {Number} value the 32-bit integer in question.
 * @return {Long} the corresponding Long value.
 * @api public
 */
Long.fromInt = function(value) {
  if (-128 <= value && value < 128) {
    var cachedObj = Long.INT_CACHE_[value];
    if (cachedObj) {
      return cachedObj;
    }
  }

  var obj = new Long(value | 0, value < 0 ? -1 : 0);
  if (-128 <= value && value < 128) {
    Long.INT_CACHE_[value] = obj;
  }
  return obj;
};

/**
 * Returns a Long representing the given value, provided that it is a finite number. Otherwise, zero is returned.
 *
 * @param {Number} value the number in question.
 * @return {Long} the corresponding Long value.
 * @api public
 */
Long.fromNumber = function(value) {
  if (isNaN(value) || !isFinite(value)) {
    return Long.ZERO;
  } else if (value <= -Long.TWO_PWR_63_DBL_) {
    return Long.MIN_VALUE;
  } else if (value + 1 >= Long.TWO_PWR_63_DBL_) {
    return Long.MAX_VALUE;
  } else if (value < 0) {
    return Long.fromNumber(-value).negate();
  } else {
    return new Long(
               (value % Long.TWO_PWR_32_DBL_) | 0,
               (value / Long.TWO_PWR_32_DBL_) | 0);
  }
};

/**
 * Returns a Long representing the 64-bit integer that comes by concatenating the given high and low bits. Each is assumed to use 32 bits.
 *
 * @param {Number} lowBits the low 32-bits.
 * @param {Number} highBits the high 32-bits.
 * @return {Long} the corresponding Long value.
 * @api public
 */
Long.fromBits = function(lowBits, highBits) {
  return new Long(lowBits, highBits);
};

/**
 * Returns a Long representation of the given string, written using the given radix.
 *
 * @param {String} str the textual representation of the Long.
 * @param {Number} opt_radix the radix in which the text is written.
 * @return {Long} the corresponding Long value.
 * @api public
 */
Long.fromString = function(str, opt_radix) {
  if (str.length == 0) {
    throw Error('number format error: empty string');
  }

  var radix = opt_radix || 10;
  if (radix < 2 || 36 < radix) {
    throw Error('radix out of range: ' + radix);
  }

  if (str.charAt(0) == '-') {
    return Long.fromString(str.substring(1), radix).negate();
  } else if (str.indexOf('-') >= 0) {
    throw Error('number format error: interior "-" character: ' + str);
  }

  // Do several (8) digits each time through the loop, so as to
  // minimize the calls to the very expensive emulated div.
  var radixToPower = Long.fromNumber(Math.pow(radix, 8));

  var result = Long.ZERO;
  for (var i = 0; i < str.length; i += 8) {
    var size = Math.min(8, str.length - i);
    var value = parseInt(str.substring(i, i + size), radix);
    if (size < 8) {
      var power = Long.fromNumber(Math.pow(radix, size));
      result = result.multiply(power).add(Long.fromNumber(value));
    } else {
      result = result.multiply(radixToPower);
      result = result.add(Long.fromNumber(value));
    }
  }
  return result;
};

// NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the
// from* methods on which they depend.


/**
 * A cache of the Long representations of small integer values.
 * @type {Object}
 * @api private
 */
Long.INT_CACHE_ = {};

// NOTE: the compiler should inline these constant values below and then remove
// these variables, so there should be no runtime penalty for these.

/**
 * Number used repeated below in calculations.  This must appear before the
 * first call to any from* function below.
 * @type {number}
 * @api private
 */
Long.TWO_PWR_16_DBL_ = 1 << 16;

/**
 * @type {number}
 * @api private
 */
Long.TWO_PWR_24_DBL_ = 1 << 24;

/**
 * @type {number}
 * @api private
 */
Long.TWO_PWR_32_DBL_ = Long.TWO_PWR_16_DBL_ * Long.TWO_PWR_16_DBL_;

/**
 * @type {number}
 * @api private
 */
Long.TWO_PWR_31_DBL_ = Long.TWO_PWR_32_DBL_ / 2;

/**
 * @type {number}
 * @api private
 */
Long.TWO_PWR_48_DBL_ = Long.TWO_PWR_32_DBL_ * Long.TWO_PWR_16_DBL_;

/**
 * @type {number}
 * @api private
 */
Long.TWO_PWR_64_DBL_ = Long.TWO_PWR_32_DBL_ * Long.TWO_PWR_32_DBL_;

/**
 * @type {number}
 * @api private
 */
Long.TWO_PWR_63_DBL_ = Long.TWO_PWR_64_DBL_ / 2;

/** @type {Long} */
Long.ZERO = Long.fromInt(0);

/** @type {Long} */
Long.ONE = Long.fromInt(1);

/** @type {Long} */
Long.NEG_ONE = Long.fromInt(-1);

/** @type {Long} */
Long.MAX_VALUE =
    Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0);

/** @type {Long} */
Long.MIN_VALUE = Long.fromBits(0, 0x80000000 | 0);

/**
 * @type {Long}
 * @api private
 */
Long.TWO_PWR_24_ = Long.fromInt(1 << 24);

/**
 * Expose.
 */
if(typeof window === 'undefined') {
  exports.Long = Long;
}
},{}],3:[function(require,module,exports){
(function (Buffer,__dirname){
var
    fs = require("fs");

const
    //ISC_MASK   = 0x14000000, // Defines the code as a valid ISC code
    FAC_MASK   = 0x00FF0000, // Specifies the facility where the code is located
    CODE_MASK  = 0x0000FFFF, // Specifies the code in the message file
    CLASS_MASK = 0xF0000000; // Defines the code as warning, error, info, or other

var msgNumber = exports.msgNumber = function(facility, code) {
    return (facility * 10000 + code);
};

var getCode = exports.getCode = function(code) {
    return (code & CODE_MASK)
};

var getFacility = exports.getFacility =  function(code) {
    return (code & FAC_MASK) >> 16;
};

exports.getClass = function(code) {
    return (code & CLASS_MASK) >> 30
};

exports.lookupMessages = function(status, callback){

    var handle;
    var bucket_size;
    var top_tree;
    var levels;
    var buffer;

    function lookup(item, callback){
        var code = msgNumber(getFacility(item.gdscode), getCode(item.gdscode));

        function readIndex(stackSize, position) {
            function readNode(from) {
                var ret = {};
                ret.code = buffer.readUInt32LE(from);
                ret.seek = buffer.readUInt32LE(from + 4);
                return ret;
            }
            fs.read(handle, buffer, 0, bucket_size, position,
                function(err, bufferSize) {
                    if (bufferSize <= 0) {
                        callback();
                    } else if (stackSize == levels){
                        search();
                    } else {
                        var from = 0;
                        var node = readNode(from);

                        while (true) {
                            if (node.code >= code)
                            {
                                readIndex(stackSize + 1, node.seek);
                                break;
                            }
                            from += 8;
                            if (from >= bufferSize)
                            {
                                callback();
                                break;
                            }
                            node = readNode(from);
                        }
                    }
                }
            );
        }

        function search(){
            function readRec(from) {
                function align(v) {
                    return (v + 3) & ~3;
                }
                var ret = {};
                ret.code = buffer.readUInt32LE(from);
                ret.length = buffer.readUInt16LE(from + 4);
                if (ret.code == code){
                    from += 8;
                    ret.text = buffer.toString(null, from, from + ret.length);
                } else {
                    ret.seek = from + align(8 + ret.length, 4);
                }
                return ret;
            }
            var rec = readRec(0);
            while (rec.seek) {
                if (rec.seek >= buffer.length) {
                    break;
                } else {
                    rec = readRec(rec.seek);
                }
            }
            var str = rec.text;
            if (item.params) {
                for (var i = 0; i < item.params.length; i++) {
                    str = str.replace("@" + String(i+1), item.params[i]);
                }
            }
            callback(str);
        }
        readIndex(1, top_tree);
    }

    fs.open(__dirname + "/firebird.msg", 'r',
        function(err, h){
            if (!h) {
                callback();
                return;
            }

            buffer = new Buffer(14);
            fs.read(h, buffer, 0, 14, 0,
                function(){
                    handle = h;
                    bucket_size = buffer.readUInt16LE(2);
                    top_tree = buffer.readUInt32LE(4);
                    levels = buffer.readUInt16LE(12);
                    buffer = new Buffer(bucket_size);

                    var i = 0;
                    var text;
                    function loop(){
                        lookup(status[i],
                            function(line){
                                if (text) {
                                    text = text + ", " + line
                                } else {
                                    text = line;
                                }
                                if (i == status.length - 1) {
                                    fs.close(handle);
                                    callback(text);
                                } else {
                                    i++;
                                    loop();
                                }
                            }
                        );
                    }
                    loop(0);
                }
            );
        }
    );
};

}).call(this,require("buffer").Buffer,"/")
},{"buffer":6,"fs":5}],4:[function(require,module,exports){
(function (Buffer){

var Long = require('./long.js').Long;

function align(n) {
    return (n + 3) & ~3;
}

/***************************************
 *
 *   BLR Writer
 *
 ***************************************/

const
    MAX_STRING_SIZE = 255;

var BlrWriter = exports.BlrWriter = function(size){
    this.buffer = new Buffer(size || 32);
    this.pos = 0;
};

BlrWriter.prototype.addByte = function (b) {
    this.ensure(1);
    this.buffer.writeUInt8(b, this.pos);
    this.pos++;
};

BlrWriter.prototype.addShort = function (b) {
    this.ensure(1);
    this.buffer.writeInt8(b, this.pos);
    this.pos++;
};

BlrWriter.prototype.addSmall = function (b) {
    this.ensure(2);
    this.buffer.writeInt16LE(b, this.pos);
    this.pos += 2;
};

BlrWriter.prototype.addWord = function (b) {
    this.ensure(2);
    this.buffer.writeUInt16LE(b, this.pos);
    this.pos += 2;
};

BlrWriter.prototype.addNumeric = function (c, v) {
    if (v < 256){
        this.ensure(3);
        this.buffer.writeUInt8(c, this.pos);
        this.pos++;
        this.buffer.writeUInt8(1, this.pos);
        this.pos++;
        this.buffer.writeUInt8(v, this.pos);
        this.pos++;
    } else {
        this.ensure(6);
        this.buffer.writeUInt8(c, this.pos);
        this.pos++;
        this.buffer.writeUInt8(4, this.pos);
        this.pos++;
        this.buffer.writeInt32BE(v, this.pos);
        this.pos += 4;
    }
};

BlrWriter.prototype.addBytes = function (b) {
    this.ensure(b.length);
    for (var i = 0; i < b.length; i++) {
        this.buffer.writeUInt8(b[i], this.pos);
        this.pos++;
    }
};

BlrWriter.prototype.addString = function (c, s, encoding) {
    this.addByte(c);
    var len = Buffer.byteLength(s, encoding);
    if (len > MAX_STRING_SIZE){
        throw new Error('blr string is too big');
    }
    this.ensure(len + 1);
    this.buffer.writeUInt8(len, this.pos);
    this.pos++;
    this.buffer.write(s, this.pos, s.length, encoding);
    this.pos += len;
};

BlrWriter.prototype.addBuffer = function (b) {
    this.addSmall(b.length);
    this.ensure(b.length);
    b.copy(this.buffer, this.pos);
    this.pos += b.length;
};

/***************************************
 *
 *   BLR Reader
 *
 ***************************************/

var BlrReader = exports.BlrReader = function(buffer) {
    this.buffer = buffer;
    this.pos = 0;
};

BlrReader.prototype.readByteCode = function(){
    return this.buffer.readUInt8(this.pos++);
};

BlrReader.prototype.readInt = function(){
    var len = this.buffer.readUInt16LE(this.pos);
    this.pos += 2;
    var value;
    switch (len) {
        case 1:
            value = this.buffer.readInt8(this.pos);
            break;
        case 2:
            value = this.buffer.readInt16LE(this.pos);
            break;
        case 4:
            value = this.buffer.readInt32LE(this.pos)
    }
    this.pos += len;
    return value;
};

BlrReader.prototype.readString = function(encoding){
    var len = this.buffer.readUInt16LE(this.pos);
    var str;
    this.pos += 2;
    if (len > 0) {
        str = this.buffer.toString(encoding, this.pos, this.pos + len);
        this.pos += len;
    } else {
        str = '';
    }
    return str;
};

BlrReader.prototype.readSegment = function() {
    var ret, tmp;
    var len = this.buffer.readUInt16LE(this.pos);
    this.pos += 2;
    while (len > 0) {
        if (ret) {
            tmp = ret;
            ret = new Buffer(tmp.length + len);
            tmp.copy(ret);
            this.buffer.copy(ret, tmp.length, this.pos, this.pos + len);
        } else {
            ret = new Buffer(len);
            this.buffer.copy(ret, 0, this.pos, this.pos + len);
        }
        this.pos += len;
        if (this.pos == this.buffer.length) {
            break;
        }
        len = this.buffer.readUInt16LE(this.pos);
        this.pos += 2;
    }
    return ret;
};

/***************************************
 *
 *   XDR Writer
 *
 ***************************************/

var XdrWriter = exports.XdrWriter = function(size){
    this.buffer = new Buffer(size || 32);
    this.pos = 0;
};

XdrWriter.prototype.ensure =
    BlrWriter.prototype.ensure = function (len) {
        var newlen = this.buffer.length;
        while (newlen < this.pos + len) {
            newlen *= 2
        }

        if (this.buffer.length < newlen) {
            var b = new Buffer(newlen);
            this.buffer.copy(b);
            delete(this.buffer);
            this.buffer = b;
        }
    };

XdrWriter.prototype.addInt = function (value) {
    this.ensure(4);
    this.buffer.writeInt32BE(value, this.pos);
    this.pos += 4;
};

XdrWriter.prototype.addInt64 = function (value) {
    this.ensure(8);
    var l = new Long(value);
    this.buffer.writeInt32BE(l.high_, this.pos);
    this.pos += 4;
    this.buffer.writeInt32BE(l.low_, this.pos);
    this.pos += 4;
};

XdrWriter.prototype.addUInt = function (value) {
    this.ensure(4);
    this.buffer.writeUInt32BE(value, this.pos);
    this.pos += 4;
};

XdrWriter.prototype.addString = function(s, encoding) {
    var len = Buffer.byteLength(s, encoding);
    var alen = align(len);
    this.ensure(alen + 4);
    this.buffer.writeInt32BE(len, this.pos);
    this.pos += 4;
    this.buffer.write(s, this.pos, len, encoding);
    this.pos += alen;
};

XdrWriter.prototype.addText = function(s, encoding) {
    var len = Buffer.byteLength(s, encoding);
    var alen = align(len);
    this.ensure(alen);
    this.buffer.write(s, this.pos, len, encoding);
    this.pos += alen;
};

XdrWriter.prototype.addBlr = function(blr) {
    var alen = align(blr.pos);
    this.ensure(alen + 4);
    this.buffer.writeInt32BE(blr.pos, this.pos);
    this.pos += 4;
    blr.buffer.copy(this.buffer, this.pos);
    this.pos += alen;
};

XdrWriter.prototype.getData = function() {
    return this.buffer.slice(0, this.pos);
};

XdrWriter.prototype.addDouble = function(value) {
    this.ensure(8);
    this.buffer.writeDoubleBE(value, this.pos);
    this.pos += 8;
};

XdrWriter.prototype.addQuad = function(quad) {
    this.ensure(8);
    var b = this.buffer;
    b.writeInt32BE(quad.high, this.pos);
    this.pos += 4;
    b.writeInt32BE(quad.low, this.pos);
    this.pos += 4;
};

/***************************************
 *
 *   XDR Reader
 *
 ***************************************/

var XdrReader = exports.XdrReader = function(buffer){
    this.buffer = buffer;
    this.pos = 0;
};

XdrReader.prototype.readInt = function () {
    var r = this.buffer.readInt32BE(this.pos);
    this.pos += 4;
    return r;
};

XdrReader.prototype.readUInt = function () {
    var r = this.buffer.readUInt32BE(this.pos);
    this.pos += 4;
    return r;
};

XdrReader.prototype.readInt64 = function () {
    var high = this.buffer.readInt32BE(this.pos);
    this.pos += 4;
    var low = this.buffer.readInt32BE(this.pos);
    this.pos += 4;
    return new Long(low, high);
};

XdrReader.prototype.readShort = function () {
    var r = this.buffer.readInt16BE(this.pos);
    this.pos += 2;
    return r;
};

XdrReader.prototype.readQuad = function () {
    var b = this.buffer;
    var high = b.readInt32BE(this.pos);
    this.pos += 4;
    var low = b.readInt32BE(this.pos);
    this.pos += 4;
    return {low: low, high: high}
};

XdrReader.prototype.readFloat = function () {
    var r = this.buffer.readFloatBE(this.pos);
    this.pos += 4;
    return r;
};

XdrReader.prototype.readDouble = function () {
    var r = this.buffer.readDoubleBE(this.pos);
    this.pos += 8;
    return r;
};

XdrReader.prototype.readArray = function () {
    var len = this.readInt();
    if (len) {
        var r = this.buffer.slice(this.pos, this.pos + len);
        this.pos += align(len);
        return r;
    }
};

XdrReader.prototype.readBuffer = function (len) {
    if (!arguments.length) {
       len = this.readInt();
    }
    if (len) {
        var r = this.buffer.slice(this.pos, this.pos + len);
        this.pos += align(len);
        return r;
    }
};

XdrReader.prototype.readString = function (encoding) {
    var len = this.readInt();
    return this.readText(len, encoding);
};

XdrReader.prototype.readText = function (len, encoding) {
    if (len > 0) {
        var r = this.buffer.toString(encoding, this.pos, this.pos + len);
        this.pos += align(len);
        return r;
    } else {
        return '';
    }
};

}).call(this,require("buffer").Buffer)
},{"./long.js":2,"buffer":6}],5:[function(require,module,exports){

},{}],6:[function(require,module,exports){
/**
 * The buffer module from node.js, for the browser.
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install buffer`
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
   // Detect if browser supports Typed Arrays. Supported browsers are IE 10+,
   // Firefox 4+, Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+.
  if (typeof Uint8Array === 'undefined' || typeof ArrayBuffer === 'undefined')
    return false

  // Does the browser support adding properties to `Uint8Array` instances? If
  // not, then that's the same as no `Uint8Array` support. We need to be able to
  // add all the node Buffer API methods.
  // Relevant Firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var arr = new Uint8Array(0)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // Assume object is an array
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof Uint8Array === 'function' &&
      subject instanceof Uint8Array) {
    // Speed optimization -- use set if we're copying from a Uint8Array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  // copy!
  for (var i = 0; i < end - start; i++)
    target[i + target_start] = this[i + start]
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array === 'function') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment the Uint8Array *instance* (not the class!) with Buffer methods
 */
function augment (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0,
      'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":7,"ieee754":8}],7:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var ZERO   = '0'.charCodeAt(0)
	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	module.exports.toByteArray = b64ToByteArray
	module.exports.fromByteArray = uint8ToBase64
}())

},{}],8:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],9:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],10:[function(require,module,exports){
exports.endianness = function () { return 'LE' };

exports.hostname = function () {
    if (typeof location !== 'undefined') {
        return location.hostname
    }
    else return '';
};

exports.loadavg = function () { return [] };

exports.uptime = function () { return 0 };

exports.freemem = function () {
    return Number.MAX_VALUE;
};

exports.totalmem = function () {
    return Number.MAX_VALUE;
};

exports.cpus = function () { return [] };

exports.type = function () { return 'Browser' };

exports.release = function () {
    if (typeof navigator !== 'undefined') {
        return navigator.appVersion;
    }
    return '';
};

exports.networkInterfaces
= exports.getNetworkInterfaces
= function () { return {} };

exports.arch = function () { return 'javascript' };

exports.platform = function () { return 'browser' };

exports.tmpdir = exports.tmpDir = function () {
    return '/tmp';
};

exports.EOL = '\n';

},{}]},{},[1])
